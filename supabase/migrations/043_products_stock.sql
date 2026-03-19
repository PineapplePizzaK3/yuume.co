-- Adiciona stock (quantidade em estoque) aos produtos da loja.
-- Ao comprar: diminui o stock; se chegar a 0, marca produto como inativo (sem estoque).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.products.stock_quantity IS 'Quantidade em estoque. NULL = ilimitado. Ao chegar em 0, produto fica inativo (is_active=false).';

-- Admin: criar produto com stock
CREATE OR REPLACE FUNCTION public.admin_create_product(p_product jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_img_url text;
  v_img_urls jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  v_img_url := NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text;
  v_img_urls := COALESCE(p_product->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_img_urls) <> 'array' OR jsonb_array_length(v_img_urls) = 0 THEN
    IF v_img_url IS NOT NULL THEN
      v_img_urls := jsonb_build_array(v_img_url);
    ELSE
      v_img_urls := '[]'::jsonb;
    END IF;
  END IF;
  WITH inserted AS (
    INSERT INTO public.products (name, description, price, image_url, image_urls, is_active, weight_kg, stock_quantity)
    VALUES (
      (p_product->>'name')::text,
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      (p_product->>'price')::numeric,
      v_img_url,
      v_img_urls,
      COALESCE((p_product->>'is_active')::boolean, true),
      COALESCE((p_product->>'weight_kg')::numeric, 0),
      CASE
        WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = ''
        THEN NULL
        ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
      END
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: atualizar produto (inclui stock)
CREATE OR REPLACE FUNCTION public.admin_update_product(p_id uuid, p_product jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_img_url text;
  v_img_urls jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  v_img_url := NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text;
  v_img_urls := COALESCE(p_product->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_img_urls) <> 'array' OR jsonb_array_length(v_img_urls) = 0 THEN
    IF v_img_url IS NOT NULL THEN
      v_img_urls := jsonb_build_array(v_img_url);
    ELSE
      v_img_urls := '[]'::jsonb;
    END IF;
  END IF;
  WITH updated AS (
    UPDATE public.products
    SET
      name = (p_product->>'name')::text,
      description = NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      price = (p_product->>'price')::numeric,
      image_url = v_img_url,
      image_urls = v_img_urls,
      is_active = COALESCE((p_product->>'is_active')::boolean, true),
      weight_kg = COALESCE((p_product->>'weight_kg')::numeric, 0),
      stock_quantity = CASE
        WHEN p_product ? 'stock_quantity' AND (p_product->>'stock_quantity') IS NOT NULL AND trim(COALESCE(p_product->>'stock_quantity','')) <> ''
        THEN GREATEST((p_product->>'stock_quantity')::integer, 0)
        WHEN p_product ? 'stock_quantity'
        THEN NULL
        ELSE stock_quantity
      END,
      updated_at = NOW()
    WHERE id = p_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  RETURN v_result;
END;
$$;

-- create_store_order: validar stock antes de criar pedido e diminuir stock após inserir itens
CREATE OR REPLACE FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean DEFAULT false,
  p_shipping_cost numeric DEFAULT NULL,
  p_shipping_currency text DEFAULT 'JPY',
  p_shipping_address_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item RECORD;
  v_total numeric := 0;
  v_order jsonb;
  v_ship_cost numeric;
  v_ship_currency text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_shipping_address_id IS NULL THEN
    RAISE EXCEPTION 'Endereço obrigatório';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.addresses a
    WHERE a.id = p_shipping_address_id
      AND a.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Endereço inválido';
  END IF;

  IF p_shipping_cost IS NOT NULL AND p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;

  -- Validar stock antes de criar o pedido (stock_quantity NULL = ilimitado)
  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.name, p.stock_quantity
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    WHERE ci.user_id = p_user_id
  LOOP
    IF v_item.stock_quantity IS NOT NULL AND v_item.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Produto "%" não possui estoque suficiente. Disponível: %, solicitado: %',
        v_item.name, v_item.stock_quantity, v_item.quantity;
    END IF;
  END LOOP;

  v_ship_cost := CASE WHEN p_ship_immediately THEN p_shipping_cost ELSE NULL END;
  v_ship_currency := COALESCE(NULLIF(trim(p_shipping_currency), ''), 'JPY');

  -- Inserir pedido
  INSERT INTO public.orders (user_id, created_by, order_source, ship_immediately, status, shipping_address_id)
  VALUES (
    p_user_id,
    p_user_id,
    'store',
    p_ship_immediately,
    'awaiting_payment',
    p_shipping_address_id
  )
  RETURNING id INTO v_order_id;

  -- Inserir order_items e diminuir stock
  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.price, p.stock_quantity
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    WHERE ci.user_id = p_user_id
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.price);
    v_total := v_total + (v_item.price * v_item.quantity);

    -- Diminuir stock (apenas se tem controle); se chegar a 0, marcar como sem estoque (inativo)
    IF v_item.stock_quantity IS NOT NULL THEN
      UPDATE public.products
      SET
        stock_quantity = GREATEST(stock_quantity - v_item.quantity, 0),
        is_active = CASE WHEN (stock_quantity - v_item.quantity) <= 0 THEN false ELSE is_active END,
        updated_at = NOW()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  IF v_total <= 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id;
    RAISE EXCEPTION 'Carrinho vazio ou inválido';
  END IF;

  UPDATE public.orders
  SET total_amount = v_total,
      shipping_cost = v_ship_cost,
      shipping_currency = CASE WHEN v_ship_cost IS NOT NULL THEN v_ship_currency ELSE shipping_currency END
  WHERE id = v_order_id;

  -- Limpar carrinho
  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  SELECT to_jsonb(o) INTO v_order FROM public.orders o WHERE id = v_order_id;
  RETURN v_order;
END;
$$;
