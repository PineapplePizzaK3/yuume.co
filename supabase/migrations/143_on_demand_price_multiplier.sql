-- Multiplicador de preço da aba On-Demand (Loja).
-- Preço final = preço original do catálogo × multiplicador (padrão 1.15).

INSERT INTO public.system_settings (key, value)
VALUES ('on_demand_price_multiplier', jsonb_build_object('amount', 1.15))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_ephemeral_product(
  p_payload jsonb,
  p_ttl_minutes integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_store_id text;
  v_external_url text;
  v_title text;
  v_image_url text;
  v_currency text;
  v_price numeric;
  v_source text;
  v_multiplier numeric;
  v_expires_at timestamptz;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  v_store_id := NULLIF(trim(COALESCE(p_payload->>'storeId', p_payload->>'store_id', '')), '');
  v_external_url := NULLIF(trim(COALESCE(p_payload->>'productUrl', p_payload->>'external_url', '')), '');
  v_title := NULLIF(trim(COALESCE(p_payload->>'title', '')), '');
  v_image_url := NULLIF(trim(COALESCE(p_payload->>'imageUrl', p_payload->>'image_url', '')), '');
  v_currency := COALESCE(NULLIF(trim(COALESCE(p_payload->>'currency', 'JPY')), ''), 'JPY');
  v_price := COALESCE((p_payload->>'price')::numeric, 0);
  v_source := NULLIF(trim(COALESCE(
    p_payload->>'source',
    p_payload->'sourcePayload'->>'source',
    ''
  )), '');

  IF v_store_id IS NULL OR v_external_url IS NULL OR v_title IS NULL THEN
    RAISE EXCEPTION 'Payload inválido para criar produto efêmero';
  END IF;
  IF v_price < 0 THEN
    RAISE EXCEPTION 'Preço inválido';
  END IF;

  -- On-Demand: aplica margem configurável sobre o preço original do catálogo.
  IF v_source = 'store-direct-catalog' THEN
    v_multiplier := public.get_setting_number('on_demand_price_multiplier', 1.15);
    IF v_multiplier IS NULL OR v_multiplier <= 0 THEN
      v_multiplier := 1.15;
    END IF;
    v_price := ROUND(v_price * v_multiplier);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(mins => GREATEST(10, LEAST(COALESCE(p_ttl_minutes, 120), 24 * 60)));

  INSERT INTO public.ephemeral_products (
    token, created_by, store_id, external_url, title, snapshot_price_jpy, currency, image_url, raw_payload, expires_at
  ) VALUES (
    v_token, v_uid, v_store_id, v_external_url, v_title, v_price, v_currency, v_image_url, COALESCE(p_payload, '{}'::jsonb), v_expires_at
  );

  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ephemeral_product(jsonb, integer) TO anon, authenticated;
