-- Permite criar lote sem produtos e atualizar lote existente (adicionar/editar itens).

CREATE UNIQUE INDEX IF NOT EXISTS idx_calculator_batch_items_batch_product
  ON public.calculator_batch_items(batch_id, calculator_product_id);

CREATE OR REPLACE FUNCTION public.calculator_batch_recalc_weights(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products_weight integer := 0;
  v_protection_weight integer := 0;
BEGIN
  SELECT COALESCE(SUM(line_weight_grams), 0)
  INTO v_products_weight
  FROM public.calculator_batch_items
  WHERE batch_id = p_batch_id;

  SELECT COALESCE(protection_weight_grams, 0)
  INTO v_protection_weight
  FROM public.calculator_batches
  WHERE id = p_batch_id;

  UPDATE public.calculator_batches
  SET
    products_weight_grams = v_products_weight,
    total_weight_grams = v_products_weight + v_protection_weight
  WHERE id = p_batch_id;
END;
$$;

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

  IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'items deve ser um array';
  END IF;

  INSERT INTO public.calculator_batches (
    name, notes, protection_weight_grams, products_weight_grams, total_weight_grams, created_by
  ) VALUES (
    v_name, v_notes, v_protection_weight, 0, v_protection_weight, v_uid
  )
  RETURNING * INTO v_batch;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    v_product_id := NULLIF(v_item->>'calculator_product_id', '')::uuid;
    IF v_product_id IS NULL THEN
      CONTINUE;
    END IF;

    v_quantity := GREATEST(COALESCE((v_item->>'quantity')::integer, 0), 0);
    IF v_quantity <= 0 THEN
      CONTINUE;
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
    )
    ON CONFLICT (batch_id, calculator_product_id)
    DO UPDATE SET
      quantity = EXCLUDED.quantity,
      unit_weight_grams = EXCLUDED.unit_weight_grams,
      line_weight_grams = EXCLUDED.line_weight_grams,
      snapshot = EXCLUDED.snapshot;
  END LOOP;

  PERFORM public.calculator_batch_recalc_weights(v_batch.id);

  SELECT * INTO v_batch FROM public.calculator_batches WHERE id = v_batch.id;
  RETURN row_to_json(v_batch)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_calculator_batch(
  p_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.calculator_batches%ROWTYPE;
  v_items jsonb;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.calculator_products%ROWTYPE;
  v_line_weight integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_batch
  FROM public.calculator_batches
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado';
  END IF;

  UPDATE public.calculator_batches
  SET
    name = COALESCE(NULLIF(trim(COALESCE(p_payload->>'name', '')), ''), name),
    notes = CASE
      WHEN p_payload ? 'notes' THEN NULLIF(trim(COALESCE(p_payload->>'notes', '')), '')
      ELSE notes
    END,
    protection_weight_grams = CASE
      WHEN p_payload ? 'protection_weight_grams' THEN GREATEST(COALESCE((p_payload->>'protection_weight_grams')::integer, 0), 0)
      ELSE protection_weight_grams
    END
  WHERE id = p_id
  RETURNING * INTO v_batch;

  IF p_payload ? 'items' THEN
    v_items := COALESCE(p_payload->'items', '[]'::jsonb);
    IF jsonb_typeof(v_items) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'items deve ser um array';
    END IF;

    DELETE FROM public.calculator_batch_items WHERE batch_id = p_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items)
    LOOP
      v_product_id := NULLIF(v_item->>'calculator_product_id', '')::uuid;
      IF v_product_id IS NULL THEN
        CONTINUE;
      END IF;

      v_quantity := GREATEST(COALESCE((v_item->>'quantity')::integer, 0), 0);
      IF v_quantity <= 0 THEN
        CONTINUE;
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

      INSERT INTO public.calculator_batch_items (
        batch_id,
        calculator_product_id,
        quantity,
        unit_weight_grams,
        line_weight_grams,
        snapshot
      ) VALUES (
        p_id,
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
  END IF;

  PERFORM public.calculator_batch_recalc_weights(p_id);

  SELECT * INTO v_batch FROM public.calculator_batches WHERE id = p_id;
  RETURN row_to_json(v_batch)::jsonb;
END;
$$;
