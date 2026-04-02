-- Alinha JPY→USD no Postgres ao câmbio spot (sem margem/taxa/buffer).
-- Antes: create_store_order e products_derive_multicurrency_prices usavam v_mult
-- (default buffer 5% em pricing_jpy_usd_buffer_percent gerava ~5% de diferença vs API Frankfurter).

CREATE OR REPLACE FUNCTION public.products_derive_multicurrency_prices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base_jpy numeric;
  v_jpy_usd numeric;
  v_usd_brl numeric;
  v_usd numeric;
  v_brl numeric;
BEGIN
  v_base_jpy := ROUND(COALESCE(NEW.price_jpy, NEW.price, 0)::numeric, 2);

  NEW.price := v_base_jpy;
  NEW.price_jpy := v_base_jpy;

  IF v_base_jpy <= 0 THEN
    NEW.price_usd := NULL;
    NEW.price_brl := NULL;
    RETURN NEW;
  END IF;

  v_jpy_usd := GREATEST(0.0000001, public.get_setting_number('fx_jpy_usd', 0.0066));
  v_usd_brl := GREATEST(0.0001, public.get_setting_number('fx_usd_brl', 5.50));

  v_usd := v_base_jpy * v_jpy_usd;
  v_brl := v_usd * v_usd_brl;

  NEW.price_usd := ROUND(v_usd::numeric, 4);
  NEW.price_brl := ROUND(v_brl::numeric, 2);
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.products.price_usd IS 'Preço em USD = price_jpy × fx_jpy_usd (spot, sem multiplicador de margem)';

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
  v_total_brl numeric := 0;
  v_total_usd numeric := 0;
  v_loja_usd numeric := 0;
  v_grupo_usd numeric := 0;
  v_grupo_qty int := 0;
  v_jpy_usd numeric;
  v_usd_brl numeric;
  v_line_usd numeric;
  v_grupo_fee_usd numeric := 0;
  v_fee_unit_usd numeric;
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

  v_jpy_usd := GREATEST(0.0000001, public.get_setting_number('fx_jpy_usd', 0.0066));
  v_usd_brl := GREATEST(0.0001, public.get_setting_number('fx_usd_brl', 5.50));
  v_fee_unit_usd := GREATEST(0, public.get_setting_number('grupo_compras_fee_per_unit_usd', 1.90));

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
    SELECT
      ci.product_id,
      ci.quantity,
      p.price,
      p.price_jpy,
      p.price_usd,
      p.purchase_group_id
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    LEFT JOIN public.store_products sp ON sp.product_id = p.id AND sp.is_active = true
    WHERE ci.user_id = p_user_id
      AND (p.purchase_group_id IS NOT NULL OR sp.product_id IS NOT NULL)
  LOOP
    v_line_usd := COALESCE(
      NULLIF(v_item.price_usd, 0)::numeric,
      (COALESCE(v_item.price_jpy, v_item.price, 0)::numeric * v_jpy_usd)
    );

    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (
      v_order_id,
      v_item.product_id,
      v_item.quantity,
      ROUND(COALESCE(v_item.price_jpy, v_item.price, 0)::numeric, 2)
    );

    IF v_item.purchase_group_id IS NULL THEN
      v_loja_usd := v_loja_usd + (v_line_usd * v_item.quantity);
    ELSE
      v_grupo_usd := v_grupo_usd + (v_line_usd * v_item.quantity);
      v_grupo_qty := v_grupo_qty + v_item.quantity::int;
    END IF;
  END LOOP;

  IF (v_loja_usd + v_grupo_usd) <= 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id;
    RAISE EXCEPTION 'Carrinho vazio ou inválido';
  END IF;

  IF v_grupo_qty > 0 THEN
    v_grupo_fee_usd := (v_grupo_usd * 0.20) + (v_fee_unit_usd * v_grupo_qty);
  END IF;

  v_total_usd := v_loja_usd + v_grupo_usd + v_grupo_fee_usd;
  v_total_brl := ROUND((v_total_usd * v_usd_brl)::numeric, 2);

  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    v_coupon_result := public.validate_coupon(trim(p_coupon_code), v_total_brl);
    IF (v_coupon_result->>'valid')::boolean = true THEN
      v_coupon_id := (v_coupon_result->>'coupon_id')::uuid;
      v_discount := (v_coupon_result->>'discount_brl')::numeric;
      v_discount := LEAST(v_discount, v_total_brl);
    ELSE
      DELETE FROM public.orders WHERE id = v_order_id;
      RAISE EXCEPTION '%', v_coupon_result->>'error';
    END IF;
  END IF;

  v_total_brl := GREATEST(ROUND((v_total_brl - v_discount)::numeric, 2), 0);
  v_total_usd := CASE
    WHEN v_usd_brl > 0 THEN ROUND((v_total_brl / v_usd_brl)::numeric, 4)
    ELSE v_total_usd
  END;

  UPDATE public.orders
  SET
    total_amount = v_total_brl,
    total_amount_usd = v_total_usd,
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

-- Recalcula catálogo com fx atual (spot), para não ficar price_usd “inchado” até o próximo UPDATE.
UPDATE public.products p
SET
  price_usd = ROUND(
    (ROUND(COALESCE(p.price_jpy, p.price, 0)::numeric, 2) * s.jpy_usd)::numeric,
    4
  ),
  price_brl = ROUND(
    (ROUND(COALESCE(p.price_jpy, p.price, 0)::numeric, 2) * s.jpy_usd * s.usd_brl)::numeric,
    2
  )
FROM (
  SELECT
    GREATEST(0.0000001, public.get_setting_number('fx_jpy_usd', 0.0066)) AS jpy_usd,
    GREATEST(0.0001, public.get_setting_number('fx_usd_brl', 5.50)) AS usd_brl
) s
WHERE COALESCE(p.price_jpy, p.price, 0) > 0;
