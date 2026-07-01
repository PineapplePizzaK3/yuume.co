-- Lotes montados a partir dos produtos da calculadora Brasil.

CREATE TABLE IF NOT EXISTS public.calculator_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text NULL,
  protection_weight_grams integer NOT NULL DEFAULT 0 CHECK (protection_weight_grams >= 0),
  products_weight_grams integer NOT NULL DEFAULT 0 CHECK (products_weight_grams >= 0),
  total_weight_grams integer NOT NULL DEFAULT 0 CHECK (total_weight_grams >= 0),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calculator_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.calculator_batches(id) ON DELETE CASCADE,
  calculator_product_id uuid NOT NULL REFERENCES public.calculator_products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_weight_grams integer NOT NULL CHECK (unit_weight_grams > 0),
  line_weight_grams integer NOT NULL CHECK (line_weight_grams > 0),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_calculator_batches_created_at
  ON public.calculator_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculator_batch_items_batch_id
  ON public.calculator_batch_items(batch_id);

ALTER TABLE public.calculator_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculator_batch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage calculator batches" ON public.calculator_batches;
CREATE POLICY "Admins can manage calculator batches"
  ON public.calculator_batches
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage calculator batch items" ON public.calculator_batch_items;
CREATE POLICY "Admins can manage calculator batch items"
  ON public.calculator_batch_items
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_create_calculator_batch(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_notes text;
  v_protection_weight integer;
  v_items jsonb;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.calculator_products%ROWTYPE;
  v_line_weight integer;
  v_products_weight integer := 0;
  v_total_weight integer := 0;
  v_batch public.calculator_batches%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_name := NULLIF(trim(COALESCE(p_payload->>'name', '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Nome do lote é obrigatório';
  END IF;

  v_uid := auth.uid();
  v_notes := NULLIF(trim(COALESCE(p_payload->>'notes', '')), '');
  v_protection_weight := GREATEST(COALESCE((p_payload->>'protection_weight_grams')::integer, 0), 0);
  v_items := COALESCE(p_payload->'items', '[]'::jsonb);

  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos 1 item no lote';
  END IF;

  INSERT INTO public.calculator_batches (
    name, notes, protection_weight_grams, products_weight_grams, total_weight_grams, created_by
  ) VALUES (
    v_name, v_notes, v_protection_weight, 0, 0, v_uid
  )
  RETURNING * INTO v_batch;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_product_id := NULLIF(v_item->>'calculator_product_id', '')::uuid;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Item inválido: calculator_product_id ausente';
    END IF;

    v_quantity := GREATEST(COALESCE((v_item->>'quantity')::integer, 0), 0);
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Item inválido: quantidade deve ser maior que zero';
    END IF;

    SELECT * INTO v_product
    FROM public.calculator_products
    WHERE id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto da calculadora não encontrado: %', v_product_id;
    END IF;

    IF COALESCE(v_product.weight_grams, 0) <= 0 THEN
      RAISE EXCEPTION 'Produto sem peso válido: %', v_product.name;
    END IF;

    v_line_weight := v_product.weight_grams * v_quantity;
    v_products_weight := v_products_weight + v_line_weight;

    INSERT INTO public.calculator_batch_items (
      batch_id,
      calculator_product_id,
      quantity,
      unit_weight_grams,
      line_weight_grams,
      snapshot
    ) VALUES (
      v_batch.id,
      v_product.id,
      v_quantity,
      v_product.weight_grams,
      v_line_weight,
      jsonb_build_object(
        'name', v_product.name,
        'base_cost_yen', v_product.base_cost_yen,
        'landed_cost_brl', v_product.landed_cost_brl,
        'final_price_brl', v_product.final_price_brl,
        'weight_grams', v_product.weight_grams
      )
    );
  END LOOP;

  v_total_weight := v_products_weight + v_protection_weight;

  UPDATE public.calculator_batches
  SET
    products_weight_grams = v_products_weight,
    total_weight_grams = v_total_weight
  WHERE id = v_batch.id
  RETURNING * INTO v_batch;

  RETURN row_to_json(v_batch)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_calculator_batches(
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
        b.*,
        p.name AS created_by_name,
        p.email AS created_by_email,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'calculator_product_id', i.calculator_product_id,
              'quantity', i.quantity,
              'unit_weight_grams', i.unit_weight_grams,
              'line_weight_grams', i.line_weight_grams,
              'snapshot', i.snapshot
            )
            ORDER BY i.id
          )
          FROM public.calculator_batch_items i
          WHERE i.batch_id = b.id
        ), '[]'::jsonb) AS items
      FROM public.calculator_batches b
      LEFT JOIN public.profiles p ON p.id = b.created_by
      ORDER BY b.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_calculator_batch(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.calculator_batches WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado';
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', p_id);
END;
$$;
