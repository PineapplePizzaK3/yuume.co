-- Multi-moeda: JPY (base custo) → USD (cobrança) → BRL (exibição/cupom).
-- Pedidos da loja: total_amount_usd = valor transacional; total_amount = BRL derivado (cupons).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_jpy NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS price_usd NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS price_brl NUMERIC(14,2);

UPDATE public.products
SET price_jpy = ROUND(COALESCE(price_jpy, price, 0)::numeric, 2)
WHERE price_jpy IS NULL AND price IS NOT NULL;

COMMENT ON COLUMN public.products.price_jpy IS 'Preço base em ienes (custo de referência no Japão)';
COMMENT ON COLUMN public.products.price_usd IS 'Preço final de venda em USD (com margem/taxa/buffer no pipeline)';
COMMENT ON COLUMN public.products.price_brl IS 'Derivado apenas de USD × cotação (exibição)';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC(14,4);

COMMENT ON COLUMN public.orders.total_amount_usd IS 'Total transacional em USD (loja). BRL em total_amount é derivado para UI/cupom.';

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_currency_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_currency_check CHECK (currency IN ('JPY', 'BRL', 'USD'));

INSERT INTO public.system_settings (key, value) VALUES
  ('fx_jpy_usd', jsonb_build_object('amount', 0.0066)),
  ('fx_usd_brl', jsonb_build_object('amount', 5.50)),
  ('fx_rates_updated_at', jsonb_build_object('text', '')),
  ('pricing_margin_percent', jsonb_build_object('amount', 0)),
  ('pricing_platform_fee_percent', jsonb_build_object('amount', 0)),
  ('pricing_jpy_usd_buffer_percent', jsonb_build_object('amount', 5)),
  ('grupo_compras_fee_per_unit_usd', jsonb_build_object('amount', 1.90))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.products_sync_price_jpy_from_price()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.price IS NOT NULL THEN
    NEW.price_jpy := ROUND(NEW.price::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_price_jpy ON public.products;
CREATE TRIGGER trg_products_sync_price_jpy
  BEFORE INSERT OR UPDATE OF price ON public.products
  FOR EACH ROW
  EXECUTE PROCEDURE public.products_sync_price_jpy_from_price();

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
  v_margin numeric;
  v_platform_fee numeric;
  v_buffer numeric;
  v_mult numeric;
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
  v_margin := GREATEST(0, public.get_setting_number('pricing_margin_percent', 0));
  v_platform_fee := GREATEST(0, public.get_setting_number('pricing_platform_fee_percent', 0));
  v_buffer := GREATEST(0, public.get_setting_number('pricing_jpy_usd_buffer_percent', 5));
  v_mult := (1 + v_margin / 100.0) * (1 + v_platform_fee / 100.0) * (1 + v_buffer / 100.0);
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
      (COALESCE(v_item.price_jpy, v_item.price, 0)::numeric * v_jpy_usd * v_mult)
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
