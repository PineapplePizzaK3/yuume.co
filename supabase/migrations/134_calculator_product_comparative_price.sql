-- Campo opcional de preço comparativo (mercado BR) para produtos da calculadora.

ALTER TABLE public.calculator_products
  ADD COLUMN IF NOT EXISTS comparative_price_brl numeric(14,2) NULL CHECK (comparative_price_brl >= 0);

CREATE OR REPLACE FUNCTION public.admin_create_calculator_product(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_row public.calculator_products%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_uid := auth.uid();
  v_name := NULLIF(trim(COALESCE(p_payload->>'name', '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório';
  END IF;

  IF COALESCE((p_payload->>'weight_grams')::integer, 0) <= 0 THEN
    RAISE EXCEPTION 'Peso inválido';
  END IF;

  IF COALESCE((p_payload->>'final_price_brl')::numeric, 0) <= 0 THEN
    RAISE EXCEPTION 'Preço final inválido';
  END IF;

  INSERT INTO public.calculator_products (
    name,
    notes,
    base_cost_yen,
    declared_value_yen,
    weight_grams,
    shipping_mode,
    direct_method,
    lote_kg,
    customs_factor,
    brl_per_jpy,
    margin_percent,
    comparative_price_brl,
    packaging_brl,
    local_shipping_brl,
    international_shipping_yen,
    landed_cost_yen,
    landed_cost_brl,
    final_price_brl,
    calculation_snapshot,
    created_by
  ) VALUES (
    v_name,
    NULLIF(trim(COALESCE(p_payload->>'notes', '')), ''),
    GREATEST(COALESCE((p_payload->>'base_cost_yen')::numeric, 0), 0),
    GREATEST(COALESCE((p_payload->>'declared_value_yen')::numeric, 0), 0),
    GREATEST((p_payload->>'weight_grams')::integer, 1),
    CASE WHEN lower(trim(COALESCE(p_payload->>'shipping_mode', 'lote'))) = 'direto' THEN 'direto' ELSE 'lote' END,
    NULLIF(lower(trim(COALESCE(p_payload->>'direct_method', ''))), ''),
    NULLIF((p_payload->>'lote_kg')::numeric, 0),
    GREATEST(COALESCE((p_payload->>'customs_factor')::numeric, 2), 0),
    GREATEST(COALESCE((p_payload->>'brl_per_jpy')::numeric, 0.0000001), 0.0000001),
    GREATEST(COALESCE((p_payload->>'margin_percent')::numeric, 0), 0),
    CASE
      WHEN p_payload ? 'comparative_price_brl' AND COALESCE((p_payload->>'comparative_price_brl')::numeric, 0) > 0
        THEN (p_payload->>'comparative_price_brl')::numeric
      ELSE NULL
    END,
    GREATEST(COALESCE((p_payload->>'packaging_brl')::numeric, 0), 0),
    GREATEST(COALESCE((p_payload->>'local_shipping_brl')::numeric, 0), 0),
    GREATEST(COALESCE((p_payload->>'international_shipping_yen')::numeric, 0), 0),
    GREATEST(COALESCE((p_payload->>'landed_cost_yen')::numeric, 0), 0),
    GREATEST(COALESCE((p_payload->>'landed_cost_brl')::numeric, 0), 0),
    GREATEST(COALESCE((p_payload->>'final_price_brl')::numeric, 0), 0),
    COALESCE(p_payload->'calculation_snapshot', '{}'::jsonb),
    v_uid
  )
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_calculator_product(
  p_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_row public.calculator_products%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_row
  FROM public.calculator_products
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado';
  END IF;

  v_name := COALESCE(NULLIF(trim(COALESCE(p_payload->>'name', '')), ''), v_row.name);
  IF v_name IS NULL OR trim(v_name) = '' THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório';
  END IF;

  IF p_payload ? 'weight_grams' AND COALESCE((p_payload->>'weight_grams')::integer, 0) <= 0 THEN
    RAISE EXCEPTION 'Peso inválido';
  END IF;

  IF p_payload ? 'final_price_brl' AND COALESCE((p_payload->>'final_price_brl')::numeric, 0) <= 0 THEN
    RAISE EXCEPTION 'Preço final inválido';
  END IF;

  UPDATE public.calculator_products
  SET
    name = v_name,
    notes = CASE
      WHEN p_payload ? 'notes' THEN NULLIF(trim(COALESCE(p_payload->>'notes', '')), '')
      ELSE notes
    END,
    base_cost_yen = CASE
      WHEN p_payload ? 'base_cost_yen' THEN GREATEST(COALESCE((p_payload->>'base_cost_yen')::numeric, 0), 0)
      ELSE base_cost_yen
    END,
    declared_value_yen = CASE
      WHEN p_payload ? 'declared_value_yen' THEN GREATEST(COALESCE((p_payload->>'declared_value_yen')::numeric, 0), 0)
      ELSE declared_value_yen
    END,
    weight_grams = CASE
      WHEN p_payload ? 'weight_grams' THEN GREATEST((p_payload->>'weight_grams')::integer, 1)
      ELSE weight_grams
    END,
    shipping_mode = CASE
      WHEN p_payload ? 'shipping_mode' THEN
        CASE WHEN lower(trim(COALESCE(p_payload->>'shipping_mode', 'lote'))) = 'direto' THEN 'direto' ELSE 'lote' END
      ELSE shipping_mode
    END,
    direct_method = CASE
      WHEN p_payload ? 'direct_method' THEN NULLIF(lower(trim(COALESCE(p_payload->>'direct_method', ''))), '')
      WHEN p_payload ? 'shipping_mode' AND lower(trim(COALESCE(p_payload->>'shipping_mode', ''))) = 'lote' THEN NULL
      ELSE direct_method
    END,
    lote_kg = CASE
      WHEN p_payload ? 'lote_kg' THEN NULLIF((p_payload->>'lote_kg')::numeric, 0)
      WHEN p_payload ? 'shipping_mode' AND lower(trim(COALESCE(p_payload->>'shipping_mode', ''))) = 'direto' THEN NULL
      ELSE lote_kg
    END,
    customs_factor = CASE
      WHEN p_payload ? 'customs_factor' THEN GREATEST(COALESCE((p_payload->>'customs_factor')::numeric, 2), 0)
      ELSE customs_factor
    END,
    brl_per_jpy = CASE
      WHEN p_payload ? 'brl_per_jpy' THEN GREATEST(COALESCE((p_payload->>'brl_per_jpy')::numeric, 0.0000001), 0.0000001)
      ELSE brl_per_jpy
    END,
    margin_percent = CASE
      WHEN p_payload ? 'margin_percent' THEN GREATEST(COALESCE((p_payload->>'margin_percent')::numeric, 0), 0)
      ELSE margin_percent
    END,
    comparative_price_brl = CASE
      WHEN p_payload ? 'comparative_price_brl' AND COALESCE((p_payload->>'comparative_price_brl')::numeric, 0) > 0
        THEN (p_payload->>'comparative_price_brl')::numeric
      WHEN p_payload ? 'comparative_price_brl' THEN NULL
      ELSE comparative_price_brl
    END,
    packaging_brl = CASE
      WHEN p_payload ? 'packaging_brl' THEN GREATEST(COALESCE((p_payload->>'packaging_brl')::numeric, 0), 0)
      ELSE packaging_brl
    END,
    local_shipping_brl = CASE
      WHEN p_payload ? 'local_shipping_brl' THEN GREATEST(COALESCE((p_payload->>'local_shipping_brl')::numeric, 0), 0)
      ELSE local_shipping_brl
    END,
    international_shipping_yen = CASE
      WHEN p_payload ? 'international_shipping_yen' THEN GREATEST(COALESCE((p_payload->>'international_shipping_yen')::numeric, 0), 0)
      ELSE international_shipping_yen
    END,
    landed_cost_yen = CASE
      WHEN p_payload ? 'landed_cost_yen' THEN GREATEST(COALESCE((p_payload->>'landed_cost_yen')::numeric, 0), 0)
      ELSE landed_cost_yen
    END,
    landed_cost_brl = CASE
      WHEN p_payload ? 'landed_cost_brl' THEN GREATEST(COALESCE((p_payload->>'landed_cost_brl')::numeric, 0), 0)
      ELSE landed_cost_brl
    END,
    final_price_brl = CASE
      WHEN p_payload ? 'final_price_brl' THEN GREATEST(COALESCE((p_payload->>'final_price_brl')::numeric, 0), 0)
      ELSE final_price_brl
    END,
    calculation_snapshot = CASE
      WHEN p_payload ? 'calculation_snapshot' THEN COALESCE(p_payload->'calculation_snapshot', '{}'::jsonb)
      ELSE calculation_snapshot
    END
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;
