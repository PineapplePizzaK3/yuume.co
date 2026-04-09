-- Apply referral discount for indicated users in checkout intent + legacy create_store_order flow.
-- Also persists referral linkage so referrer credit trigger can run on shipment/completion.

ALTER TABLE public.store_checkout_intents
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_discount_amount numeric;

CREATE OR REPLACE FUNCTION public.store_intent_materialize_order(p_intent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.store_checkout_intents%ROWTYPE;
  v_line RECORD;
  v_order_id uuid;
  v_stock int;
  v_name text;
BEGIN
  SELECT * INTO v_intent
  FROM public.store_checkout_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intenção de checkout não encontrada';
  END IF;

  IF v_intent.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Intenção de checkout já utilizada';
  END IF;

  IF v_intent.expires_at < now() THEN
    RAISE EXCEPTION 'Intenção de checkout expirada. Refaça o checkout.';
  END IF;

  FOR v_line IN
    SELECT
      (e.value->>'product_id')::uuid AS product_id,
      GREATEST(1, LEAST(99, COALESCE((e.value->>'quantity')::int, 1))) AS quantity,
      (e.value->>'price_jpy')::numeric AS price_jpy
    FROM jsonb_array_elements(v_intent.line_items) WITH ORDINALITY AS e(value, ordn)
  LOOP
    SELECT p.stock_quantity, p.name INTO v_stock, v_name
    FROM public.products p
    WHERE p.id = v_line.product_id AND p.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não disponível';
    END IF;

    IF v_stock IS NOT NULL AND v_stock < v_line.quantity THEN
      RAISE EXCEPTION 'Produto "%" sem estoque suficiente', v_name;
    END IF;
  END LOOP;

  INSERT INTO public.orders (
    user_id,
    created_by,
    order_source,
    ship_immediately,
    status,
    shipping_address_id,
    total_amount,
    total_amount_usd,
    shipping_cost,
    shipping_currency,
    coupon_id,
    discount_amount,
    acquisition_mode,
    referral_id,
    referral_discount_amount,
    checkout_intent_id
  )
  VALUES (
    v_intent.user_id,
    v_intent.user_id,
    'store',
    v_intent.ship_immediately,
    'awaiting_payment',
    v_intent.shipping_address_id,
    v_intent.total_amount,
    v_intent.total_amount_usd,
    v_intent.shipping_cost_jpy,
    CASE
      WHEN v_intent.shipping_cost_jpy IS NOT NULL THEN COALESCE(NULLIF(trim(v_intent.shipping_currency), ''), 'JPY')
      ELSE NULL
    END,
    v_intent.coupon_id,
    CASE WHEN COALESCE(v_intent.discount_amount, 0) > 0 THEN v_intent.discount_amount ELSE NULL END,
    CASE WHEN v_intent.referral_id IS NOT NULL AND COALESCE(v_intent.referral_discount_amount, 0) > 0 THEN 'referral' ELSE 'none' END,
    v_intent.referral_id,
    CASE WHEN COALESCE(v_intent.referral_discount_amount, 0) > 0 THEN v_intent.referral_discount_amount ELSE NULL END,
    v_intent.id
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT
      (e.value->>'product_id')::uuid AS product_id,
      GREATEST(1, LEAST(99, COALESCE((e.value->>'quantity')::int, 1))) AS quantity,
      (e.value->>'price_jpy')::numeric AS price_jpy
    FROM jsonb_array_elements(v_intent.line_items) WITH ORDINALITY AS e(value, ordn)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, v_line.product_id, v_line.quantity, ROUND(v_line.price_jpy::numeric, 2));
  END LOOP;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_store_checkout_intent(
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
  v_item RECORD;
  v_total_brl numeric := 0;
  v_total_usd numeric := 0;
  v_loja_usd numeric := 0;
  v_grupo_usd numeric := 0;
  v_grupo_qty int := 0;
  v_jpy_usd numeric;
  v_jpy_usd_eff numeric;
  v_markup numeric;
  v_usd_brl numeric;
  v_line_usd numeric;
  v_grupo_fee_usd numeric := 0;
  v_fee_unit_usd numeric;
  v_ship_cost numeric;
  v_ship_currency text;
  v_coupon_result jsonb;
  v_coupon_id uuid;
  v_coupon_discount numeric := 0;
  v_referral public.referrals%ROWTYPE;
  v_referral_discount_cfg numeric := 0;
  v_referral_discount_applied numeric := 0;
  v_total_discount numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  v_sum_line_jpy numeric := 0;
  v_full_brl numeric;
  v_line_charge_jpy numeric;
  v_brl_based_jpy numeric;
  v_usd_based_jpy numeric;
  v_charge_jpy numeric;
  v_intent_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_shipping_address_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = p_shipping_address_id AND a.user_id = p_user_id
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
  v_markup := GREATEST(0, public.get_setting_number('wise_usd_jpy_withdrawal_markup_percent', 0.73));
  v_jpy_usd_eff := v_jpy_usd * (1 + v_markup / 100.0);
  v_fee_unit_usd := GREATEST(0, public.get_setting_number('grupo_compras_fee_per_unit_usd', 1.90));

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
      (COALESCE(v_item.price_jpy, v_item.price, 0)::numeric * v_jpy_usd_eff)
    );

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_item.product_id,
        'quantity', v_item.quantity,
        'price_jpy', ROUND(COALESCE(v_item.price_jpy, v_item.price, 0)::numeric, 2)
      )
    );

    v_sum_line_jpy := v_sum_line_jpy + (
      ROUND(COALESCE(v_item.price_jpy, v_item.price, 0)::numeric, 2) * v_item.quantity
    );

    IF v_item.purchase_group_id IS NULL THEN
      v_loja_usd := v_loja_usd + (v_line_usd * v_item.quantity);
    ELSE
      v_grupo_usd := v_grupo_usd + (v_line_usd * v_item.quantity);
      v_grupo_qty := v_grupo_qty + v_item.quantity::int;
    END IF;
  END LOOP;

  IF (v_loja_usd + v_grupo_usd) <= 0 THEN
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
      v_coupon_discount := (v_coupon_result->>'discount_brl')::numeric;
      v_coupon_discount := LEAST(v_coupon_discount, v_total_brl);
    ELSE
      RAISE EXCEPTION '%', v_coupon_result->>'error';
    END IF;
  END IF;

  SELECT *
  INTO v_referral
  FROM public.referrals
  WHERE referred_id = p_user_id
    AND status IN ('pending', 'approved', 'qualified')
    AND reward_given = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_referral.id IS NOT NULL THEN
    v_referral_discount_cfg := GREATEST(0, public.get_setting_number('referral_discount_value', 0));
    v_referral_discount_applied := LEAST(v_referral_discount_cfg, GREATEST(v_total_brl - v_coupon_discount, 0));
  END IF;

  v_total_discount := v_coupon_discount + v_referral_discount_applied;
  v_total_brl := GREATEST(ROUND((v_total_brl - v_total_discount)::numeric, 2), 0);
  v_total_usd := CASE
    WHEN v_usd_brl > 0 THEN ROUND((v_total_brl / v_usd_brl)::numeric, 4)
    ELSE v_total_usd
  END;

  v_full_brl := v_total_brl + COALESCE(v_total_discount, 0);
  v_line_charge_jpy := CASE
    WHEN v_sum_line_jpy > 0 AND v_full_brl > 0 THEN ROUND(v_sum_line_jpy * (v_total_brl / v_full_brl))
    ELSE NULL
  END;
  v_brl_based_jpy := public.brl_to_jpy_for_store_charge(v_total_brl);
  v_usd_based_jpy := CASE
    WHEN v_jpy_usd_eff > 0 AND v_total_usd > 0 THEN ROUND(v_total_usd / v_jpy_usd_eff)
    ELSE NULL
  END;

  v_charge_jpy := GREATEST(
    COALESCE(v_line_charge_jpy, 0),
    COALESCE(v_usd_based_jpy, 0),
    COALESCE(v_brl_based_jpy, 0)
  );

  IF v_charge_jpy IS NULL OR v_charge_jpy <= 0 THEN
    RAISE EXCEPTION 'Não foi possível calcular o valor em JPY para o checkout';
  END IF;

  INSERT INTO public.store_checkout_intents (
    user_id,
    ship_immediately,
    shipping_cost_jpy,
    shipping_currency,
    shipping_address_id,
    coupon_id,
    discount_amount,
    referral_id,
    referral_discount_amount,
    total_amount,
    total_amount_usd,
    charge_jpy,
    line_items
  )
  VALUES (
    p_user_id,
    p_ship_immediately,
    v_ship_cost,
    v_ship_currency,
    p_shipping_address_id,
    v_coupon_id,
    CASE WHEN v_total_discount > 0 THEN v_total_discount ELSE NULL END,
    CASE WHEN v_referral.id IS NOT NULL AND v_referral_discount_applied > 0 THEN v_referral.id ELSE NULL END,
    CASE WHEN v_referral_discount_applied > 0 THEN v_referral_discount_applied ELSE NULL END,
    v_total_brl,
    v_total_usd,
    v_charge_jpy,
    v_lines
  )
  RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'intent_id', v_intent_id,
    'total_amount', v_total_brl,
    'total_amount_usd', v_total_usd,
    'charge_jpy', v_charge_jpy,
    'discount_amount', v_total_discount,
    'referral_discount_amount', v_referral_discount_applied
  );
END;
$$;

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
  v_jpy_usd_eff numeric;
  v_markup numeric;
  v_usd_brl numeric;
  v_line_usd numeric;
  v_grupo_fee_usd numeric := 0;
  v_fee_unit_usd numeric;
  v_order jsonb;
  v_ship_cost numeric;
  v_ship_currency text;
  v_coupon_result jsonb;
  v_coupon_id uuid;
  v_coupon_discount numeric := 0;
  v_referral public.referrals%ROWTYPE;
  v_referral_discount_cfg numeric := 0;
  v_referral_discount_applied numeric := 0;
  v_total_discount numeric := 0;
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
  v_markup := GREATEST(0, public.get_setting_number('wise_usd_jpy_withdrawal_markup_percent', 0.73));
  v_jpy_usd_eff := v_jpy_usd * (1 + v_markup / 100.0);
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
      (COALESCE(v_item.price_jpy, v_item.price, 0)::numeric * v_jpy_usd_eff)
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
      v_coupon_discount := (v_coupon_result->>'discount_brl')::numeric;
      v_coupon_discount := LEAST(v_coupon_discount, v_total_brl);
    ELSE
      DELETE FROM public.orders WHERE id = v_order_id;
      RAISE EXCEPTION '%', v_coupon_result->>'error';
    END IF;
  END IF;

  SELECT *
  INTO v_referral
  FROM public.referrals
  WHERE referred_id = p_user_id
    AND status IN ('pending', 'approved', 'qualified')
    AND reward_given = false
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_referral.id IS NOT NULL THEN
    v_referral_discount_cfg := GREATEST(0, public.get_setting_number('referral_discount_value', 0));
    v_referral_discount_applied := LEAST(v_referral_discount_cfg, GREATEST(v_total_brl - v_coupon_discount, 0));
  END IF;

  v_total_discount := v_coupon_discount + v_referral_discount_applied;
  v_total_brl := GREATEST(ROUND((v_total_brl - v_total_discount)::numeric, 2), 0);
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
    discount_amount = CASE WHEN v_total_discount > 0 THEN v_total_discount ELSE NULL END,
    acquisition_mode = CASE WHEN v_referral.id IS NOT NULL AND v_referral_discount_applied > 0 THEN 'referral' ELSE 'none' END,
    referral_id = CASE WHEN v_referral.id IS NOT NULL AND v_referral_discount_applied > 0 THEN v_referral.id ELSE NULL END,
    referral_discount_amount = CASE WHEN v_referral_discount_applied > 0 THEN v_referral_discount_applied ELSE NULL END
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
