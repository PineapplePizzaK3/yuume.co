-- Step 7: collector wishlist_items (catalog wants). Legacy wishlist_links untouched.

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  target_price_jpy numeric(14,2) CHECK (target_price_jpy IS NULL OR target_price_jpy >= 0),
  priority integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, catalog_item_id)
);

COMMENT ON TABLE public.wishlist_items IS
  'Explicit catalog wants for the collector loop. URL wants stay in wishlist_links until Step 12.';

DROP TRIGGER IF EXISTS wishlist_items_touch_updated_at ON public.wishlist_items;
CREATE TRIGGER wishlist_items_touch_updated_at
  BEFORE UPDATE ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

CREATE INDEX IF NOT EXISTS wishlist_items_user_idx ON public.wishlist_items (user_id);
CREATE INDEX IF NOT EXISTS wishlist_items_catalog_idx ON public.wishlist_items (catalog_item_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wishlist_items_owner_all ON public.wishlist_items;
CREATE POLICY wishlist_items_owner_all ON public.wishlist_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;

-- Read-only union for Home / Wishlist page (both sources, owner-scoped via underlying RLS when selected as user).
CREATE OR REPLACE VIEW public.collector_wishlist_view
WITH (security_invoker = true)
AS
SELECT
  wi.id,
  wi.user_id,
  'catalog'::text AS kind,
  wi.catalog_item_id,
  NULL::text AS url,
  NULL::text AS product_name,
  wi.target_price_jpy,
  wi.priority,
  wi.notes,
  wi.created_at,
  wi.updated_at
FROM public.wishlist_items wi
UNION ALL
SELECT
  wl.id,
  wl.user_id,
  'url'::text AS kind,
  NULL::uuid AS catalog_item_id,
  wl.url,
  wl.product_name,
  wl.price AS target_price_jpy,
  0 AS priority,
  NULL::text AS notes,
  wl.created_at,
  COALESCE(wl.last_checked_at, wl.created_at) AS updated_at
FROM public.wishlist_links wl;

GRANT SELECT ON public.collector_wishlist_view TO authenticated;

CREATE OR REPLACE FUNCTION public.service_wishlist_upsert(
  p_catalog_item_id uuid,
  p_target_price_jpy numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.wishlist_items%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para usar a wishlist.';
  END IF;
  IF p_catalog_item_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.catalog_items WHERE id = p_catalog_item_id) THEN
    RAISE EXCEPTION 'Item de catálogo inválido.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.collection_items
    WHERE user_id = v_user_id AND catalog_item_id = p_catalog_item_id AND status = 'owned'
  ) THEN
    RAISE EXCEPTION 'Este item já está na sua coleção.';
  END IF;

  INSERT INTO public.wishlist_items (user_id, catalog_item_id, target_price_jpy, notes)
  VALUES (v_user_id, p_catalog_item_id, p_target_price_jpy, NULLIF(trim(p_notes), ''))
  ON CONFLICT (user_id, catalog_item_id) DO UPDATE SET
    target_price_jpy = EXCLUDED.target_price_jpy,
    notes = COALESCE(EXCLUDED.notes, public.wishlist_items.notes)
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_wishlist_remove(p_catalog_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para usar a wishlist.';
  END IF;
  DELETE FROM public.wishlist_items
  WHERE user_id = v_user_id AND catalog_item_id = p_catalog_item_id;
  RETURN jsonb_build_object('removed', true, 'catalog_item_id', p_catalog_item_id);
END;
$$;

REVOKE ALL ON FUNCTION public.service_wishlist_upsert(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.service_wishlist_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_wishlist_upsert(uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_wishlist_remove(uuid) TO authenticated, service_role;

-- Rollback:
--   DROP FUNCTION IF EXISTS public.service_wishlist_remove(uuid);
--   DROP FUNCTION IF EXISTS public.service_wishlist_upsert(uuid, numeric, text);
--   DROP VIEW IF EXISTS public.collector_wishlist_view;
--   DROP TABLE IF EXISTS public.wishlist_items;
