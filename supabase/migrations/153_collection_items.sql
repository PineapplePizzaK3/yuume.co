-- Step 4: user collection (collector-first). Rows exist only when the user chooses to track an item.
-- Acquisitions and holdings never auto-create collection_items. Completeness (Step 5) reads owned rows.

CREATE TABLE IF NOT EXISTS public.collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  custom_snapshot jsonb,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition text,
  grade jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'acquired', 'opening', 'import')),
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  holding_id uuid REFERENCES public.user_inventory(id) ON DELETE SET NULL,
  origin_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'owned'
    CHECK (status IN ('owned', 'sold', 'grading')),
  acquired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collection_items_identity_present CHECK (
    catalog_item_id IS NOT NULL OR custom_snapshot IS NOT NULL
  )
);

COMMENT ON TABLE public.collection_items IS
  'User-owned collectibles. Created only by explicit user action (or future import). Never auto-created from orders.';

CREATE UNIQUE INDEX IF NOT EXISTS collection_items_user_catalog_owned_uniq
  ON public.collection_items (user_id, catalog_item_id)
  WHERE status = 'owned' AND catalog_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS collection_items_user_status_idx
  ON public.collection_items (user_id, status);

CREATE INDEX IF NOT EXISTS collection_items_catalog_item_idx
  ON public.collection_items (catalog_item_id)
  WHERE catalog_item_id IS NOT NULL;

DROP TRIGGER IF EXISTS collection_items_touch_updated_at ON public.collection_items;
CREATE TRIGGER collection_items_touch_updated_at
  BEFORE UPDATE ON public.collection_items
  FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_items_owner_select ON public.collection_items;
CREATE POLICY collection_items_owner_select ON public.collection_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Writes go through SECURITY DEFINER RPCs so uniqueness / status rules stay centralized.
REVOKE INSERT, UPDATE, DELETE ON public.collection_items FROM anon, authenticated;
GRANT SELECT ON public.collection_items TO authenticated;

-- ---------------------------------------------------------------------------
-- Idempotent own / unown for a single catalog item.
-- p_owned=true  -> upsert owned row (quantity defaults to 1; existing quantity kept unless p_quantity set)
-- p_owned=false -> delete the owned row for this catalog item (sold/grading rows are left alone)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_collection_set_owned(
  p_catalog_item_id uuid,
  p_owned boolean,
  p_quantity integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_qty integer;
  v_row public.collection_items%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para atualizar a coleção.';
  END IF;
  IF p_catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'Item de catálogo inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_items WHERE id = p_catalog_item_id) THEN
    RAISE EXCEPTION 'Item de catálogo não encontrado.';
  END IF;

  IF NOT COALESCE(p_owned, false) THEN
    DELETE FROM public.collection_items
    WHERE user_id = v_user_id
      AND catalog_item_id = p_catalog_item_id
      AND status = 'owned'
    RETURNING * INTO v_row;
    RETURN jsonb_build_object(
      'owned', false,
      'item', CASE WHEN v_row.id IS NULL THEN NULL ELSE to_jsonb(v_row) END
    );
  END IF;

  v_qty := GREATEST(1, COALESCE(NULLIF(p_quantity, 0), 1));

  SELECT * INTO v_row
  FROM public.collection_items
  WHERE user_id = v_user_id
    AND catalog_item_id = p_catalog_item_id
    AND status = 'owned'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.collection_items SET
      quantity = CASE WHEN p_quantity IS NULL THEN quantity ELSE v_qty END
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.collection_items (
      user_id, catalog_item_id, quantity, source, status, acquired_at
    ) VALUES (
      v_user_id, p_catalog_item_id, v_qty, 'manual', 'owned', now()
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('owned', true, 'item', to_jsonb(v_row));
END;
$$;

-- Bulk own / unown for onboarding. One round-trip; idempotent.
CREATE OR REPLACE FUNCTION public.service_collection_bulk_mark(
  p_catalog_item_ids uuid[],
  p_owned boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ids uuid[];
  v_changed integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para atualizar a coleção.';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_catalog_item_ids, ARRAY[]::uuid[])) AS x
    WHERE x IS NOT NULL
  ) INTO v_ids;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('owned', COALESCE(p_owned, false), 'changed', 0);
  END IF;

  IF NOT COALESCE(p_owned, false) THEN
    DELETE FROM public.collection_items
    WHERE user_id = v_user_id
      AND status = 'owned'
      AND catalog_item_id = ANY (v_ids);
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    RETURN jsonb_build_object('owned', false, 'changed', v_changed);
  END IF;

  -- Insert only missing owned rows; leave existing quantities alone.
  WITH valid AS (
    SELECT c.id
    FROM public.catalog_items c
    WHERE c.id = ANY (v_ids)
  ),
  inserted AS (
    INSERT INTO public.collection_items (
      user_id, catalog_item_id, quantity, source, status, acquired_at
    )
    SELECT v_user_id, valid.id, 1, 'manual', 'owned', now()
    FROM valid
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.collection_items ci
      WHERE ci.user_id = v_user_id
        AND ci.catalog_item_id = valid.id
        AND ci.status = 'owned'
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_changed FROM inserted;

  RETURN jsonb_build_object('owned', true, 'changed', v_changed);
END;
$$;

REVOKE ALL ON FUNCTION public.service_collection_set_owned(uuid, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.service_collection_bulk_mark(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_collection_set_owned(uuid, boolean, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_collection_bulk_mark(uuid[], boolean) TO authenticated, service_role;

-- Rollback (manual):
--   DROP FUNCTION IF EXISTS public.service_collection_bulk_mark(uuid[], boolean);
--   DROP FUNCTION IF EXISTS public.service_collection_set_owned(uuid, boolean, integer);
--   DROP TABLE IF EXISTS public.collection_items;
