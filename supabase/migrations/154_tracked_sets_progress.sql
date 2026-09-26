-- Step 5: tracked sets + progress / missing (collector-first).
-- Missing is never stored: verified checklist minus owned collection_items, computed on read.
-- Percentage and missing are NULL unless catalog_sets.status = 'VERIFIED'.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS collector_preferences jsonb;

COMMENT ON COLUMN public.profiles.collector_preferences IS
  'Collector prefs: { followed_franchises: text[], followed_sets: uuid[], dismissed_items: uuid[] }. Owner update via existing profiles RLS.';

CREATE TABLE IF NOT EXISTS public.tracked_sets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.catalog_sets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, set_id)
);

COMMENT ON TABLE public.tracked_sets IS
  'Sets the user is actively completing. Missing items only apply to tracked + VERIFIED sets.';

CREATE INDEX IF NOT EXISTS tracked_sets_set_id_idx ON public.tracked_sets (set_id);

ALTER TABLE public.tracked_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracked_sets_owner_select ON public.tracked_sets;
CREATE POLICY tracked_sets_owner_select ON public.tracked_sets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS tracked_sets_owner_insert ON public.tracked_sets;
CREATE POLICY tracked_sets_owner_insert ON public.tracked_sets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS tracked_sets_owner_delete ON public.tracked_sets;
CREATE POLICY tracked_sets_owner_delete ON public.tracked_sets
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.tracked_sets TO authenticated;

-- Idempotent track / untrack helpers (optional; table RLS also works).
CREATE OR REPLACE FUNCTION public.service_collector_track_set(p_set_id uuid, p_track boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para acompanhar sets.';
  END IF;
  IF p_set_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.catalog_sets WHERE id = p_set_id) THEN
    RAISE EXCEPTION 'Set não encontrado.';
  END IF;

  IF COALESCE(p_track, true) THEN
    INSERT INTO public.tracked_sets (user_id, set_id)
    VALUES (v_user_id, p_set_id)
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('tracked', true, 'set_id', p_set_id);
  END IF;

  DELETE FROM public.tracked_sets WHERE user_id = v_user_id AND set_id = p_set_id;
  RETURN jsonb_build_object('tracked', false, 'set_id', p_set_id);
END;
$$;

-- Progress for every tracked set. percentage / missing are null unless VERIFIED.
CREATE OR REPLACE FUNCTION public.service_collector_set_progress()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para ver o progresso.';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.set_code)
      FROM (
        SELECT
          s.id AS set_id,
          s.franchise,
          s.set_code,
          s.name_ja,
          s.name_en,
          s.status,
          s.release_date,
          t.created_at AS tracked_at,
          checklist.total,
          owned.owned_count AS owned,
          CASE
            WHEN s.status = 'VERIFIED' THEN GREATEST(checklist.total - owned.owned_count, 0)
            ELSE NULL
          END AS missing,
          CASE
            WHEN s.status = 'VERIFIED' AND checklist.total > 0
              THEN round((owned.owned_count::numeric / checklist.total::numeric) * 100, 1)
            WHEN s.status = 'VERIFIED' AND checklist.total = 0 THEN 0
            ELSE NULL
          END AS percentage
        FROM public.tracked_sets t
        JOIN public.catalog_sets s ON s.id = t.set_id
        CROSS JOIN LATERAL (
          SELECT count(*)::integer AS total
          FROM public.catalog_items ci
          WHERE ci.set_id = s.id AND ci.in_checklist IS TRUE
        ) checklist
        CROSS JOIN LATERAL (
          SELECT count(*)::integer AS owned_count
          FROM public.collection_items col
          JOIN public.catalog_items ci ON ci.id = col.catalog_item_id
          WHERE col.user_id = v_user_id
            AND col.status = 'owned'
            AND ci.set_id = s.id
            AND ci.in_checklist IS TRUE
        ) owned
        WHERE t.user_id = v_user_id
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;

-- Missing checklist items for one set. Empty when the set is not VERIFIED or not tracked.
CREATE OR REPLACE FUNCTION public.service_collector_missing_items(
  p_set_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para ver itens faltantes.';
  END IF;
  IF p_set_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT s.status INTO v_status
  FROM public.catalog_sets s
  JOIN public.tracked_sets t ON t.set_id = s.id AND t.user_id = v_user_id
  WHERE s.id = p_set_id;

  IF v_status IS NULL OR v_status <> 'VERIFIED' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.number_int NULLS LAST, r.number)
      FROM (
        SELECT
          ci.id AS catalog_item_id,
          ci.number,
          ci.number_int,
          ci.name_ja,
          ci.name_en,
          ci.rarity,
          ci.kind,
          ci.set_id
        FROM public.catalog_items ci
        WHERE ci.set_id = p_set_id
          AND ci.in_checklist IS TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM public.collection_items col
            WHERE col.user_id = v_user_id
              AND col.catalog_item_id = ci.id
              AND col.status = 'owned'
          )
        ORDER BY ci.number_int NULLS LAST, ci.number
        LIMIT v_limit
        OFFSET v_offset
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_collector_track_set(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.service_collector_set_progress() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.service_collector_missing_items(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_collector_track_set(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_collector_set_progress() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_collector_missing_items(uuid, integer, integer) TO authenticated, service_role;

-- Rollback (manual):
--   DROP FUNCTION IF EXISTS public.service_collector_missing_items(uuid, integer, integer);
--   DROP FUNCTION IF EXISTS public.service_collector_set_progress();
--   DROP FUNCTION IF EXISTS public.service_collector_track_set(uuid, boolean);
--   DROP TABLE IF EXISTS public.tracked_sets;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS collector_preferences;
