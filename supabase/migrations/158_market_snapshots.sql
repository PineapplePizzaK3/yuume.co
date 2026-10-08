-- Step 10: market snapshots (aggregates only — no listings, no history).

CREATE TABLE IF NOT EXISTS public.market_snapshots (
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES public.market_sources(id) ON DELETE CASCADE,
  acquisition_method text NOT NULL DEFAULT 'api'
    CHECK (acquisition_method IN ('api', 'own_data', 'affiliate', 'manual')),
  fetched_by text NOT NULL DEFAULT 'snapshot_job'
    CHECK (fetched_by IN ('snapshot_job', 'user_search')),
  condition_scope text NOT NULL DEFAULT 'ungraded'
    CHECK (condition_scope IN ('ungraded', 'any', 'graded')),
  match_quality text NOT NULL DEFAULT 'likely'
    CHECK (match_quality IN ('exact', 'likely', 'loose')),
  refresh_status text NOT NULL DEFAULT 'ok'
    CHECK (refresh_status IN ('ok', 'empty', 'error', 'blocked')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  best_price_jpy numeric(14,2),
  median_price_jpy numeric(14,2),
  listing_count integer NOT NULL DEFAULT 0 CHECK (listing_count >= 0),
  previous_best_price_jpy numeric(14,2),
  previous_listing_count integer,
  first_available_at timestamptz,
  best_url text,
  query_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (catalog_item_id, source_id)
);

COMMENT ON TABLE public.market_snapshots IS
  'Per-(item, source) aggregate market signal. No individual listings. Filtered by market_snapshots_valid.';

CREATE INDEX IF NOT EXISTS market_snapshots_expires_idx ON public.market_snapshots (expires_at);
CREATE INDEX IF NOT EXISTS market_snapshots_checked_idx ON public.market_snapshots (checked_at DESC);

DROP TRIGGER IF EXISTS market_snapshots_touch_updated_at ON public.market_snapshots;
CREATE TRIGGER market_snapshots_touch_updated_at
  BEFORE UPDATE ON public.market_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read valid snapshots via the view; table writes are service-role only.
DROP POLICY IF EXISTS market_snapshots_authenticated_select ON public.market_snapshots;
CREATE POLICY market_snapshots_authenticated_select ON public.market_snapshots
  FOR SELECT TO authenticated
  USING (expires_at > now());

REVOKE INSERT, UPDATE, DELETE ON public.market_snapshots FROM anon, authenticated;
GRANT SELECT ON public.market_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION public.service_market_upsert_snapshot(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item uuid := (p_payload->>'catalog_item_id')::uuid;
  v_source text := NULLIF(trim(p_payload->>'source_id'), '');
  v_hours integer;
  v_prev public.market_snapshots%ROWTYPE;
  v_row public.market_snapshots%ROWTYPE;
  v_expires timestamptz;
BEGIN
  IF v_item IS NULL OR v_source IS NULL THEN
    RAISE EXCEPTION 'catalog_item_id e source_id são obrigatórios';
  END IF;
  IF NOT public.market_source_allows(v_source, 'snapshot', 'snapshot_job') THEN
    RAISE EXCEPTION 'Fonte não autorizada para snapshot: %', v_source;
  END IF;

  SELECT max_cache_hours INTO v_hours FROM public.market_sources WHERE id = v_source;
  IF COALESCE(v_hours, 0) <= 0 THEN
    RAISE EXCEPTION 'Fonte sem cache permitido: %', v_source;
  END IF;
  v_expires := now() + make_interval(hours => v_hours);

  SELECT * INTO v_prev FROM public.market_snapshots
  WHERE catalog_item_id = v_item AND source_id = v_source;

  INSERT INTO public.market_snapshots AS ms (
    catalog_item_id, source_id, acquisition_method, fetched_by, condition_scope,
    match_quality, refresh_status, checked_at, expires_at,
    best_price_jpy, median_price_jpy, listing_count,
    previous_best_price_jpy, previous_listing_count, first_available_at,
    best_url, query_used
  ) VALUES (
    v_item,
    v_source,
    COALESCE(NULLIF(p_payload->>'acquisition_method', ''), 'api'),
    COALESCE(NULLIF(p_payload->>'fetched_by', ''), 'snapshot_job'),
    COALESCE(NULLIF(p_payload->>'condition_scope', ''), 'ungraded'),
    COALESCE(NULLIF(p_payload->>'match_quality', ''), 'likely'),
    COALESCE(NULLIF(p_payload->>'refresh_status', ''), 'ok'),
    COALESCE((p_payload->>'checked_at')::timestamptz, now()),
    v_expires,
    NULLIF(p_payload->>'best_price_jpy', '')::numeric,
    NULLIF(p_payload->>'median_price_jpy', '')::numeric,
    COALESCE(NULLIF(p_payload->>'listing_count', '')::integer, 0),
    v_prev.best_price_jpy,
    v_prev.listing_count,
    CASE
      WHEN v_prev.first_available_at IS NOT NULL THEN v_prev.first_available_at
      WHEN COALESCE(NULLIF(p_payload->>'listing_count', '')::integer, 0) > 0 THEN now()
      ELSE NULL
    END,
    NULLIF(p_payload->>'best_url', ''),
    NULLIF(p_payload->>'query_used', '')
  )
  ON CONFLICT (catalog_item_id, source_id) DO UPDATE SET
    acquisition_method = EXCLUDED.acquisition_method,
    fetched_by = EXCLUDED.fetched_by,
    condition_scope = EXCLUDED.condition_scope,
    match_quality = EXCLUDED.match_quality,
    refresh_status = EXCLUDED.refresh_status,
    checked_at = EXCLUDED.checked_at,
    expires_at = EXCLUDED.expires_at,
    previous_best_price_jpy = ms.best_price_jpy,
    previous_listing_count = ms.listing_count,
    best_price_jpy = EXCLUDED.best_price_jpy,
    median_price_jpy = EXCLUDED.median_price_jpy,
    listing_count = EXCLUDED.listing_count,
    first_available_at = COALESCE(ms.first_available_at, EXCLUDED.first_available_at),
    best_url = EXCLUDED.best_url,
    query_used = EXCLUDED.query_used
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE VIEW public.market_snapshots_valid
WITH (security_invoker = true)
AS
SELECT ms.*
FROM public.market_snapshots ms
JOIN public.market_sources s ON s.id = ms.source_id
WHERE ms.expires_at > now()
  AND s.enabled
  AND ms.match_quality IN ('exact', 'likely')
  AND public.market_source_allows(ms.source_id, 'display_price', 'collector');

GRANT SELECT ON public.market_snapshots_valid TO authenticated;

REVOKE ALL ON FUNCTION public.service_market_upsert_snapshot(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_market_upsert_snapshot(jsonb) TO service_role;

-- Rollback:
--   DROP VIEW IF EXISTS public.market_snapshots_valid;
--   DROP FUNCTION IF EXISTS public.service_market_upsert_snapshot(jsonb);
--   DROP TABLE IF EXISTS public.market_snapshots;
