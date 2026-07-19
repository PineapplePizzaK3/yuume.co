-- Templates reutilizáveis para produtos da Calculadora Brasil.
-- Também corrige constraint de direct_method para aceitar Airmail
-- e endurece EXECUTE das RPCs da calculadora.

ALTER TABLE public.calculator_products
  DROP CONSTRAINT IF EXISTS calculator_products_direct_method_check;

ALTER TABLE public.calculator_products
  ADD CONSTRAINT calculator_products_direct_method_check
  CHECK (direct_method IS NULL OR direct_method IN ('ems', 'epacket', 'airmail'));

CREATE TABLE IF NOT EXISTS public.calculator_product_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  schema_version integer NOT NULL DEFAULT 1,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculator_product_templates_created_at
  ON public.calculator_product_templates(created_at DESC);

ALTER TABLE public.calculator_product_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage calculator product templates"
  ON public.calculator_product_templates;
CREATE POLICY "Admins can manage calculator product templates"
  ON public.calculator_product_templates
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_list_calculator_product_templates(
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
        cpt.*,
        p.name AS created_by_name,
        p.email AS created_by_email
      FROM public.calculator_product_templates cpt
      LEFT JOIN public.profiles p ON p.id = cpt.created_by
      ORDER BY cpt.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_calculator_product_template(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_data jsonb;
  v_row public.calculator_product_templates%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_name := NULLIF(trim(COALESCE(p_payload->>'name', '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Nome do template é obrigatório';
  END IF;

  v_data := COALESCE(p_payload->'template_data', '{}'::jsonb);
  IF jsonb_typeof(v_data) <> 'object' THEN
    RAISE EXCEPTION 'Dados do template inválidos';
  END IF;

  INSERT INTO public.calculator_product_templates (
    name,
    template_data,
    created_by
  ) VALUES (
    v_name,
    v_data,
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_calculator_product_template(
  p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.calculator_product_templates WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;

-- Harden EXECUTE: revoke PUBLIC, allow authenticated + service_role.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'admin_list_calculator_products',
        'admin_create_calculator_product',
        'admin_update_calculator_product',
        'admin_delete_calculator_product',
        'admin_list_calculator_product_templates',
        'admin_create_calculator_product_template',
        'admin_delete_calculator_product_template'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', r.schema_name, r.function_name, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', r.schema_name, r.function_name, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', r.schema_name, r.function_name, r.args);
  END LOOP;
END;
$$;
