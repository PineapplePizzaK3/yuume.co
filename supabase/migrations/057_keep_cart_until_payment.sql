-- Mantém itens no carrinho até pagamento confirmado do pedido da loja.
-- 1) create_store_order não limpa mais cart_items no momento da criação.
-- 2) Ao marcar pedido como paid/products_paid, desconta do carrinho os itens do pedido.

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

  -- Inserir order_items (SEM debitar estoque e SEM limpar carrinho agora)
  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.price
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    WHERE ci.user_id = p_user_id
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.price);
    v_total := v_total + (v_item.price * v_item.quantity);
  END LOOP;

  IF v_total <= 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id;
    RAISE EXCEPTION 'Carrinho vazio ou inválido';
  END IF;

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

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.order_source <> 'store' THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'awaiting_payment' OR NOT (NEW.status IN ('paid', 'products_paid')) THEN
    RETURN NEW;
  END IF;

  -- Validar estoque antes de permitir a transição
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.name, p.stock_quantity
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    IF v_item.stock_quantity IS NOT NULL AND v_item.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Produto "%" não possui estoque suficiente. Disponível: %, solicitado: %',
        v_item.name, v_item.stock_quantity, v_item.quantity;
    END IF;
  END LOOP;

  -- Debitar estoque
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.stock_quantity
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id AND p.stock_quantity IS NOT NULL
  LOOP
    UPDATE public.products
    SET stock_quantity = GREATEST(stock_quantity - v_item.quantity, 0),
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  -- Agora sim: descontar do carrinho apenas os itens/quantidades deste pedido.
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    UPDATE public.cart_items
    SET quantity = GREATEST(quantity - v_item.quantity, 0)
    WHERE user_id = NEW.user_id
      AND product_id = v_item.product_id;

    DELETE FROM public.cart_items
    WHERE user_id = NEW.user_id
      AND product_id = v_item.product_id
      AND quantity <= 0;
  END LOOP;

  RETURN NEW;
END;
$$;

