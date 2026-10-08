-- Step 9: optional catalog link on holdings. Existing inventory RPCs unchanged.

ALTER TABLE public.user_inventory
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_inventory_catalog_item_id_idx
  ON public.user_inventory (catalog_item_id)
  WHERE catalog_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_inventory_link_catalog_item(
  p_inventory_id uuid,
  p_catalog_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.user_inventory%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Inventário inválido.';
  END IF;
  IF p_catalog_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.catalog_items WHERE id = p_catalog_item_id
  ) THEN
    RAISE EXCEPTION 'Item de catálogo não encontrado.';
  END IF;

  UPDATE public.user_inventory
  SET catalog_item_id = p_catalog_item_id,
      updated_at = now()
  WHERE id = p_inventory_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de inventário não encontrado.';
  END IF;
  RETURN to_jsonb(v_row);
END;
$$;

-- Extend set_owned to accept optional source + holding_id for "Add to collection" from holdings.
CREATE OR REPLACE FUNCTION public.service_collection_set_owned(
  p_catalog_item_id uuid,
  p_owned boolean,
  p_quantity integer DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_holding_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_qty integer;
  v_source text := COALESCE(NULLIF(trim(p_source), ''), 'manual');
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
  IF v_source NOT IN ('manual', 'acquired', 'opening', 'import') THEN
    RAISE EXCEPTION 'Source inválido.';
  END IF;
  IF p_holding_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_inventory WHERE id = p_holding_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Holding inválido.';
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
      quantity = CASE WHEN p_quantity IS NULL THEN quantity ELSE v_qty END,
      holding_id = COALESCE(p_holding_id, holding_id),
      source = CASE WHEN p_source IS NULL THEN source ELSE v_source END
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.collection_items (
      user_id, catalog_item_id, quantity, source, status, acquired_at, holding_id
    ) VALUES (
      v_user_id, p_catalog_item_id, v_qty, v_source, 'owned', now(), p_holding_id
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('owned', true, 'item', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_inventory_link_catalog_item(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_inventory_link_catalog_item(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.service_collection_set_owned(uuid, boolean, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_collection_set_owned(uuid, boolean, integer, text, uuid) TO authenticated, service_role;
-- Keep older 3-arg signature callable if clients still use it (Postgres overloads).
GRANT EXECUTE ON FUNCTION public.service_collection_set_owned(uuid, boolean, integer) TO authenticated, service_role;

-- Rollback:
--   DROP FUNCTION IF EXISTS public.admin_inventory_link_catalog_item(uuid, uuid);
--   -- restore 153 service_collection_set_owned(uuid, boolean, integer) from 153 file if needed
--   ALTER TABLE public.user_inventory DROP COLUMN IF EXISTS catalog_item_id;
