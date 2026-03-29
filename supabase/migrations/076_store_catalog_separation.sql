-- Separa publicação da Loja Virtual da base de produtos.
-- A base continua em public.products; a loja passa a usar vínculos em public.store_products.

CREATE TABLE IF NOT EXISTS public.store_products (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_store_products_active_sort
  ON public.store_products(is_active, sort_order, created_at DESC);

-- Backfill inicial: mantém comportamento atual da loja para produtos-base.
INSERT INTO public.store_products (product_id, is_active, sort_order, created_by)
SELECT
  p.id,
  true,
  ROW_NUMBER() OVER (ORDER BY p.created_at DESC),
  NULL
FROM public.products p
WHERE p.purchase_group_id IS NULL
ON CONFLICT (product_id) DO NOTHING;

-- Público (Loja): lista somente produtos publicados na loja e ativos.
CREATE OR REPLACE FUNCTION public.list_store_products(
  p_limit INT DEFAULT 500,
  p_offset INT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 500), 1), 5000);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pr.*
      FROM public.store_products sp
      JOIN public.products pr ON pr.id = sp.product_id
      WHERE sp.is_active = true
        AND pr.is_active = true
        AND pr.purchase_group_id IS NULL
      ORDER BY sp.sort_order ASC, sp.created_at DESC, pr.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) p
  );
END;
$$;

-- Admin: lista produtos vinculados à loja (independente de ativo/inativo no produto base).
CREATE OR REPLACE FUNCTION public.admin_list_store_products(
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 1000), 1), 5000);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        pr.*,
        sp.is_active AS store_is_active,
        sp.sort_order AS store_sort_order,
        sp.created_at AS store_created_at
      FROM public.store_products sp
      JOIN public.products pr ON pr.id = sp.product_id
      WHERE pr.purchase_group_id IS NULL
      ORDER BY sp.sort_order ASC, sp.created_at DESC, pr.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) p
  );
END;
$$;

-- Admin: lista catálogo-base com flag de publicação na loja.
CREATE OR REPLACE FUNCTION public.admin_list_products(
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 1000), 1), 5000);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        pr.*,
        EXISTS (
          SELECT 1
          FROM public.store_products sp
          WHERE sp.product_id = pr.id
            AND sp.is_active = true
        ) AS store_linked
      FROM public.products pr
      ORDER BY pr.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) p
  );
END;
$$;

-- Admin: publica produto-base na loja (sem alterar/remover produto da base).
CREATE OR REPLACE FUNCTION public.admin_add_product_to_store(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_next_sort integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = p_product_id
      AND p.purchase_group_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Produto base não encontrado';
  END IF;

  SELECT COALESCE(MAX(sp.sort_order), 0) + 1
  INTO v_next_sort
  FROM public.store_products sp;

  INSERT INTO public.store_products (product_id, is_active, sort_order, created_by, updated_at)
  VALUES (p_product_id, true, v_next_sort, auth.uid(), NOW())
  ON CONFLICT (product_id) DO UPDATE
    SET is_active = true,
        updated_at = NOW();

  SELECT to_jsonb(t)
  INTO v_result
  FROM (
    SELECT
      pr.*,
      sp.is_active AS store_is_active,
      sp.sort_order AS store_sort_order,
      sp.created_at AS store_created_at
    FROM public.store_products sp
    JOIN public.products pr ON pr.id = sp.product_id
    WHERE sp.product_id = p_product_id
  ) t;

  RETURN v_result;
END;
$$;

-- Admin: remove produto da loja sem apagar da base.
CREATE OR REPLACE FUNCTION public.admin_remove_product_from_store(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.store_products sp
  WHERE sp.product_id = p_product_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object('ok', (v_rows > 0));
END;
$$;

-- Checkout: só aceita produto-base publicado na loja OU produto de grupo.
CREATE OR REPLACE FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean DEFAULT false,
  p_shipping_cost numeric DEFAULT NULL,
  p_shipping_currency text DEFAULT 'JPY',
  p_shipping_address_id uuid DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
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
  v_loja_sub numeric := 0;
  v_grupo_sub numeric := 0;
  v_grupo_qty int := 0;
  v_fx numeric;
  v_grupo_fee numeric := 0;
  v_order jsonb;
  v_ship_cost numeric;
  v_ship_currency text;
  v_coupon_result jsonb;
  v_coupon_id uuid;
  v_discount numeric := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_shipping_address_id IS NOT NULL AND NOT EXISTS (
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

  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.name, p.stock_quantity
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    LEFT JOIN public.store_products sp ON sp.product_id = p.id AND sp.is_active = true
    WHERE ci.user_id = p_user_id
      AND (p.purchase_group_id IS NOT NULL OR sp.product_id IS NOT NULL)
  LOOP
    IF v_item.stock_quantity IS NOT NULL AND v_item.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Produto "%" não possui estoque suficiente. Disponível: %, solicitado: %',
        v_item.name, v_item.stock_quantity, v_item.quantity;
    END IF;
  END LOOP;

  v_ship_cost := CASE WHEN p_ship_immediately THEN p_shipping_cost ELSE NULL END;
  v_ship_currency := COALESCE(NULLIF(trim(p_shipping_currency), ''), 'JPY');
  v_fx := GREATEST(0.0001, public.get_setting_number('fx_brl_per_jpy', 0.033));

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

  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.price, p.purchase_group_id
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    LEFT JOIN public.store_products sp ON sp.product_id = p.id AND sp.is_active = true
    WHERE ci.user_id = p_user_id
      AND (p.purchase_group_id IS NOT NULL OR sp.product_id IS NOT NULL)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.price);
    IF v_item.purchase_group_id IS NULL THEN
      v_loja_sub := v_loja_sub + (v_item.price * v_item.quantity);
    ELSE
      v_grupo_sub := v_grupo_sub + (v_item.price * v_item.quantity);
      v_grupo_qty := v_grupo_qty + v_item.quantity::int;
    END IF;
  END LOOP;

  IF (v_loja_sub + v_grupo_sub) <= 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id;
    RAISE EXCEPTION 'Carrinho vazio ou inválido';
  END IF;

  IF v_grupo_qty > 0 THEN
    v_grupo_fee := (v_grupo_sub * 0.20) + (200::numeric * v_fx * v_grupo_qty);
  END IF;

  v_total := v_loja_sub + v_grupo_sub + v_grupo_fee;

  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    v_coupon_result := public.validate_coupon(trim(p_coupon_code), v_total);
    IF (v_coupon_result->>'valid')::boolean = true THEN
      v_coupon_id := (v_coupon_result->>'coupon_id')::uuid;
      v_discount := (v_coupon_result->>'discount_brl')::numeric;
      v_discount := LEAST(v_discount, v_total);
    ELSE
      DELETE FROM public.orders WHERE id = v_order_id;
      RAISE EXCEPTION '%', v_coupon_result->>'error';
    END IF;
  END IF;

  v_total := GREATEST(v_total - v_discount, 0);

  UPDATE public.orders
  SET total_amount = v_total,
      shipping_cost = v_ship_cost,
      shipping_currency = CASE WHEN v_ship_cost IS NOT NULL THEN v_ship_currency ELSE shipping_currency END,
      coupon_id = v_coupon_id,
      discount_amount = CASE WHEN v_discount > 0 THEN v_discount ELSE NULL END
  WHERE id = v_order_id;

  IF v_coupon_id IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = v_coupon_id;
  END IF;

  SELECT to_jsonb(o) INTO v_order FROM public.orders o WHERE id = v_order_id;
  RETURN v_order;
END;
$$;
