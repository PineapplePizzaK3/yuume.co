-- Grupo de Compras: 20% sobre subtotal dos produtos do grupo + ¥200 por unidade (convertido com fx_brl_per_jpy).
-- Personal Shopping: apenas documentação / UI; orçamento continua manual no admin.

INSERT INTO public.system_settings (key, value)
VALUES ('fx_brl_per_jpy', jsonb_build_object('amount', 0.033))
ON CONFLICT (key) DO NOTHING;

UPDATE public.services
SET description = '25% do valor da compra + ¥200 por item + frete'
WHERE name = 'Personal Shopping';

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
    WHERE ci.user_id = p_user_id
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
    WHERE ci.user_id = p_user_id
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
