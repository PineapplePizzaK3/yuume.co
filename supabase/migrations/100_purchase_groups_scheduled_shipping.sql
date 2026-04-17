-- Scheduled purchase groups: configurable flat shipping (JPY) and free-shipping threshold per group.

ALTER TABLE public.purchase_groups
  ADD COLUMN IF NOT EXISTS scheduled_shipping_fee_jpy numeric;

ALTER TABLE public.purchase_groups
  ADD COLUMN IF NOT EXISTS scheduled_free_shipping_min_jpy numeric;

COMMENT ON COLUMN public.purchase_groups.scheduled_shipping_fee_jpy IS
  'Frete fixo em JPY por checkout com itens deste grupo (source scheduled). NULL = não cobrar frete configurado.';

COMMENT ON COLUMN public.purchase_groups.scheduled_free_shipping_min_jpy IS
  'Subtotal JPY dos itens deste grupo no carrinho a partir do qual o frete agendado é zero. NULL = sem isenção por piso.';

-- Sum scheduled-group shipping JPY for the user cart (one fee per group). Not granted to clients.
CREATE OR REPLACE FUNCTION public.scheduled_shipping_total_jpy_for_user_cart(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(x.fee_jpy), 0)::numeric
  FROM (
    SELECT
      CASE
        WHEN g.scheduled_free_shipping_min_jpy IS NOT NULL
          AND sub.subtotal_jpy >= g.scheduled_free_shipping_min_jpy
        THEN 0::numeric
        ELSE GREATEST(0, COALESCE(g.scheduled_shipping_fee_jpy, 0))
      END AS fee_jpy
    FROM (
      SELECT
        p.purchase_group_id AS gid,
        SUM(ROUND(COALESCE(p.price_jpy, p.price, 0)::numeric, 2) * ci.quantity) AS subtotal_jpy
      FROM public.cart_items ci
      JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
      LEFT JOIN public.store_products sp ON sp.product_id = p.id AND sp.is_active = true
      WHERE ci.user_id = p_user_id
        AND p.purchase_group_id IS NOT NULL
        AND (p.purchase_group_id IS NOT NULL OR sp.product_id IS NOT NULL)
      GROUP BY p.purchase_group_id
    ) sub
    JOIN public.purchase_groups g ON g.id = sub.gid
    WHERE g.source = 'scheduled'
      AND g.scheduled_shipping_fee_jpy IS NOT NULL
      AND g.scheduled_shipping_fee_jpy > 0
  ) x;
$$;

REVOKE ALL ON FUNCTION public.scheduled_shipping_total_jpy_for_user_cart(uuid) FROM PUBLIC;

-- Admin: create group with destination + scheduled shipping fields.
CREATE OR REPLACE FUNCTION public.admin_create_purchase_group(p_group jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_image_urls jsonb;
  v_product_ids jsonb;
  v_source text;
  v_destination text;
  v_sched_fee numeric;
  v_sched_min numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_image_urls := COALESCE(p_group->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_image_urls) <> 'array' THEN
    v_image_urls := '[]'::jsonb;
  END IF;

  v_product_ids := COALESCE(p_group->'product_ids', '[]'::jsonb);
  IF jsonb_typeof(v_product_ids) <> 'array' THEN
    v_product_ids := '[]'::jsonb;
  END IF;

  v_source := LOWER(COALESCE(NULLIF(trim(p_group->>'source'), ''), 'scheduled'));
  IF v_source NOT IN ('scheduled', 'showcase') THEN
    RAISE EXCEPTION 'Source inválido';
  END IF;

  v_destination := LOWER(NULLIF(trim(COALESCE(p_group->>'destination', '')), ''));
  IF v_destination IS NOT NULL AND v_destination NOT IN ('online', 'physical') THEN
    RAISE EXCEPTION 'Destino inválido';
  END IF;

  IF (p_group->>'name') IS NULL OR trim(p_group->>'name') = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF jsonb_array_length(v_image_urls) = 0 THEN
    RAISE EXCEPTION 'Fotos (image_urls) são obrigatórias';
  END IF;

  v_sched_fee := CASE
    WHEN p_group ? 'scheduled_shipping_fee_jpy'
      AND NULLIF(trim(COALESCE(p_group->>'scheduled_shipping_fee_jpy', '')), '') IS NOT NULL
    THEN (NULLIF(trim(p_group->>'scheduled_shipping_fee_jpy'), ''))::numeric
    ELSE NULL
  END;
  v_sched_min := CASE
    WHEN p_group ? 'scheduled_free_shipping_min_jpy'
      AND NULLIF(trim(COALESCE(p_group->>'scheduled_free_shipping_min_jpy', '')), '') IS NOT NULL
    THEN (NULLIF(trim(p_group->>'scheduled_free_shipping_min_jpy'), ''))::numeric
    ELSE NULL
  END;

  IF v_sched_fee IS NOT NULL AND v_sched_fee < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;
  IF v_sched_min IS NOT NULL AND v_sched_min < 0 THEN
    RAISE EXCEPTION 'Piso mínimo para frete zero inválido';
  END IF;

  WITH inserted AS (
    INSERT INTO public.purchase_groups (
      name, description, image_url, image_urls, is_active, product_ids, source, destination,
      scheduled_shipping_fee_jpy, scheduled_free_shipping_min_jpy, updated_at
    )
    VALUES (
      trim((p_group->>'name'))::text,
      NULLIF(trim(COALESCE(p_group->>'description','')), '')::text,
      (v_image_urls->>0)::text,
      v_image_urls,
      COALESCE((p_group->>'is_active')::boolean, true),
      v_product_ids,
      v_source,
      v_destination,
      v_sched_fee,
      v_sched_min,
      NOW()
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: update group with destination + scheduled shipping fields.
CREATE OR REPLACE FUNCTION public.admin_update_purchase_group(p_id uuid, p_group jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_image_urls jsonb;
  v_product_ids jsonb;
  v_source text;
  v_destination text;
  v_sched_fee numeric;
  v_sched_min numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_image_urls := COALESCE(p_group->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_image_urls) <> 'array' THEN
    v_image_urls := '[]'::jsonb;
  END IF;

  v_product_ids := COALESCE(p_group->'product_ids', '[]'::jsonb);
  IF jsonb_typeof(v_product_ids) <> 'array' THEN
    v_product_ids := '[]'::jsonb;
  END IF;

  v_source := LOWER(COALESCE(NULLIF(trim(p_group->>'source'), ''), 'scheduled'));
  IF v_source NOT IN ('scheduled', 'showcase') THEN
    RAISE EXCEPTION 'Source inválido';
  END IF;

  v_destination := LOWER(NULLIF(trim(COALESCE(p_group->>'destination', '')), ''));
  IF v_destination IS NOT NULL AND v_destination NOT IN ('online', 'physical') THEN
    RAISE EXCEPTION 'Destino inválido';
  END IF;

  IF (p_group->>'name') IS NULL OR trim(p_group->>'name') = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF jsonb_array_length(v_image_urls) = 0 THEN
    RAISE EXCEPTION 'Fotos (image_urls) são obrigatórias';
  END IF;

  v_sched_fee := CASE
    WHEN p_group ? 'scheduled_shipping_fee_jpy'
      AND NULLIF(trim(COALESCE(p_group->>'scheduled_shipping_fee_jpy', '')), '') IS NOT NULL
    THEN (NULLIF(trim(p_group->>'scheduled_shipping_fee_jpy'), ''))::numeric
    ELSE NULL
  END;
  v_sched_min := CASE
    WHEN p_group ? 'scheduled_free_shipping_min_jpy'
      AND NULLIF(trim(COALESCE(p_group->>'scheduled_free_shipping_min_jpy', '')), '') IS NOT NULL
    THEN (NULLIF(trim(p_group->>'scheduled_free_shipping_min_jpy'), ''))::numeric
    ELSE NULL
  END;

  IF v_sched_fee IS NOT NULL AND v_sched_fee < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;
  IF v_sched_min IS NOT NULL AND v_sched_min < 0 THEN
    RAISE EXCEPTION 'Piso mínimo para frete zero inválido';
  END IF;

  WITH updated AS (
    UPDATE public.purchase_groups
    SET
      name = trim((p_group->>'name'))::text,
      description = NULLIF(trim(COALESCE(p_group->>'description','')), '')::text,
      image_url = (v_image_urls->>0)::text,
      image_urls = v_image_urls,
      is_active = COALESCE((p_group->>'is_active')::boolean, true),
      product_ids = v_product_ids,
      source = v_source,
      destination = v_destination,
      scheduled_shipping_fee_jpy = v_sched_fee,
      scheduled_free_shipping_min_jpy = v_sched_min,
      updated_at = NOW()
    WHERE id = p_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  RETURN v_result;
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
  v_discount numeric := 0;
  v_coupon_origin_referral_id uuid;
  v_coupon_is_referral boolean := false;
  v_lines jsonb := '[]'::jsonb;
  v_sum_line_jpy numeric := 0;
  v_full_brl numeric;
  v_line_charge_jpy numeric;
  v_brl_based_jpy numeric;
  v_usd_based_jpy numeric;
  v_charge_jpy numeric;
  v_intent_id uuid;
  v_scheduled_total_jpy numeric;
  v_delta_brl numeric;
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
      v_discount := (v_coupon_result->>'discount_brl')::numeric;
      v_discount := LEAST(v_discount, v_total_brl);
      SELECT
        c.origin_referral_id,
        (c.origin_type = 'referral') AS is_referral
      INTO
        v_coupon_origin_referral_id,
        v_coupon_is_referral
      FROM public.coupons c
      WHERE c.id = v_coupon_id
      LIMIT 1;
    ELSE
      RAISE EXCEPTION '%', v_coupon_result->>'error';
    END IF;
  END IF;

  v_total_brl := GREATEST(ROUND((v_total_brl - v_discount)::numeric, 2), 0);
  v_total_usd := CASE
    WHEN v_usd_brl > 0 THEN ROUND((v_total_brl / v_usd_brl)::numeric, 4)
    ELSE v_total_usd
  END;

  v_full_brl := v_total_brl + COALESCE(v_discount, 0);
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

  v_scheduled_total_jpy := COALESCE(public.scheduled_shipping_total_jpy_for_user_cart(p_user_id), 0);
  v_charge_jpy := v_charge_jpy + v_scheduled_total_jpy;

  IF v_charge_jpy IS NULL OR v_charge_jpy <= 0 THEN
    RAISE EXCEPTION 'Não foi possível calcular o valor em JPY para o checkout';
  END IF;

  IF v_scheduled_total_jpy > 0 THEN
    v_delta_brl := ROUND(v_scheduled_total_jpy * v_jpy_usd_eff * v_usd_brl, 2);
    v_total_brl := v_total_brl + v_delta_brl;
    v_total_usd := CASE
      WHEN v_usd_brl > 0 THEN ROUND((v_total_brl / v_usd_brl)::numeric, 4)
      ELSE v_total_usd
    END;
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
    CASE WHEN v_discount > 0 THEN v_discount ELSE NULL END,
    CASE WHEN v_coupon_is_referral AND v_discount > 0 THEN v_coupon_origin_referral_id ELSE NULL END,
    CASE WHEN v_coupon_is_referral AND v_discount > 0 THEN v_discount ELSE NULL END,
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
    'discount_amount', v_discount
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
  v_discount numeric := 0;
  v_coupon_origin_referral_id uuid;
  v_coupon_is_referral boolean := false;
  v_scheduled_total_jpy numeric;
  v_delta_brl numeric;
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
      v_discount := (v_coupon_result->>'discount_brl')::numeric;
      v_discount := LEAST(v_discount, v_total_brl);
      SELECT
        c.origin_referral_id,
        (c.origin_type = 'referral') AS is_referral
      INTO
        v_coupon_origin_referral_id,
        v_coupon_is_referral
      FROM public.coupons c
      WHERE c.id = v_coupon_id
      LIMIT 1;
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

  v_scheduled_total_jpy := COALESCE(public.scheduled_shipping_total_jpy_for_user_cart(p_user_id), 0);
  IF v_scheduled_total_jpy > 0 THEN
    v_delta_brl := ROUND(v_scheduled_total_jpy * v_jpy_usd_eff * v_usd_brl, 2);
    v_total_brl := v_total_brl + v_delta_brl;
    v_total_usd := CASE
      WHEN v_usd_brl > 0 THEN ROUND((v_total_brl / v_usd_brl)::numeric, 4)
      ELSE v_total_usd
    END;
  END IF;

  UPDATE public.orders
  SET
    total_amount = v_total_brl,
    total_amount_usd = v_total_usd,
    shipping_cost = v_ship_cost,
    shipping_currency = CASE WHEN v_ship_cost IS NOT NULL THEN v_ship_currency ELSE shipping_currency END,
    coupon_id = v_coupon_id,
    discount_amount = CASE WHEN v_discount > 0 THEN v_discount ELSE NULL END,
    acquisition_mode = CASE WHEN v_coupon_is_referral AND v_discount > 0 THEN 'referral' ELSE 'none' END,
    referral_id = CASE WHEN v_coupon_is_referral AND v_discount > 0 THEN v_coupon_origin_referral_id ELSE NULL END,
    referral_discount_amount = CASE WHEN v_coupon_is_referral AND v_discount > 0 THEN v_discount ELSE NULL END
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
