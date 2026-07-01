-- Produtos cadastrados pela calculadora de preço Brasil (admin).

CREATE TABLE IF NOT EXISTS public.calculator_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text NULL,
  base_cost_yen numeric(14,2) NOT NULL CHECK (base_cost_yen >= 0),
  declared_value_yen numeric(14,2) NOT NULL CHECK (declared_value_yen >= 0),
  weight_grams integer NOT NULL CHECK (weight_grams > 0),
  shipping_mode text NOT NULL CHECK (shipping_mode IN ('lote', 'direto')),
  direct_method text NULL CHECK (direct_method IS NULL OR direct_method IN ('ems', 'epacket')),
  lote_kg numeric(6,2) NULL,
  customs_factor numeric(8,4) NOT NULL DEFAULT 2 CHECK (customs_factor >= 0),
  brl_per_jpy numeric(14,8) NOT NULL CHECK (brl_per_jpy > 0),
  margin_percent numeric(8,4) NOT NULL DEFAULT 0 CHECK (margin_percent >= 0),
  packaging_brl numeric(14,2) NOT NULL DEFAULT 0 CHECK (packaging_brl >= 0),
  local_shipping_brl numeric(14,2) NOT NULL DEFAULT 0 CHECK (local_shipping_brl >= 0),
  international_shipping_yen numeric(14,2) NOT NULL DEFAULT 0,
  landed_cost_yen numeric(14,2) NOT NULL DEFAULT 0,
  landed_cost_brl numeric(14,2) NOT NULL DEFAULT 0,
  final_price_brl numeric(14,2) NOT NULL DEFAULT 0,
  calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculator_products_created_at
  ON public.calculator_products(created_at DESC);

ALTER TABLE public.calculator_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage calculator products" ON public.calculator_products;
CREATE POLICY "Admins can manage calculator products"
  ON public.calculator_products
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_list_calculator_products(
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 200), 1), 1000);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        cp.*,
        p.name AS created_by_name,
        p.email AS created_by_email
      FROM public.calculator_products cp
      LEFT JOIN public.profiles p ON p.id = cp.created_by
      ORDER BY cp.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) t
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.admin_delete_calculator_product(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.calculator_products WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;
