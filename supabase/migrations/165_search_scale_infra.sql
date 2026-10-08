-- Shared cache, singleflight, rate limit, store slots, query stats, FTS on listing_index.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- listing_index: FTS + trigram (Fase 6)
-- ---------------------------------------------------------------------------
ALTER TABLE public.listing_index
  ADD COLUMN IF NOT EXISTS title_search tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, ''))) STORED;

CREATE INDEX IF NOT EXISTS listing_index_title_search_idx
  ON public.listing_index USING gin (title_search);

CREATE INDEX IF NOT EXISTS listing_index_title_trgm_idx
  ON public.listing_index USING gin (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Shared search cache + inflight (Fase 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_request_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_request_cache_expires_idx
  ON public.search_request_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.search_inflight (
  cache_key text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Store fetch caps + circuit (Fase 3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_fetch_window (
  store_id text NOT NULL,
  window_start timestamptz NOT NULL,
  fetch_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, window_start)
);

CREATE TABLE IF NOT EXISTS public.store_circuit (
  store_id text PRIMARY KEY,
  fail_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  open_until timestamptz
);

-- ---------------------------------------------------------------------------
-- Hot-query stats (Fase 4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_query_stats (
  query_norm text NOT NULL,
  stores_key text NOT NULL,
  query_raw text,
  stores text[] NOT NULL DEFAULT '{}',
  hit_count integer NOT NULL DEFAULT 0,
  last_requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (query_norm, stores_key)
);

CREATE INDEX IF NOT EXISTS search_query_stats_hot_idx
  ON public.search_query_stats (hit_count DESC, last_requested_at DESC);

ALTER TABLE public.search_request_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_inflight ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_fetch_window ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_circuit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_query_stats ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RPCs (service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_search_request_cache(p_cache_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  DELETE FROM public.search_request_cache WHERE expires_at <= now();
  SELECT payload INTO v_payload
  FROM public.search_request_cache
  WHERE cache_key = p_cache_key
    AND expires_at > now();
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_search_request_cache(
  p_cache_key text,
  p_payload jsonb,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.search_request_cache (cache_key, payload, expires_at)
  VALUES (
    p_cache_key,
    COALESCE(p_payload, '{}'::jsonb),
    now() + make_interval(secs => GREATEST(30, LEAST(COALESCE(p_ttl_seconds, 600), 3600)))
  )
  ON CONFLICT (cache_key) DO UPDATE
    SET payload = EXCLUDED.payload,
        expires_at = EXCLUDED.expires_at,
        created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_search_inflight(
  p_cache_key text,
  p_ttl_seconds integer DEFAULT 45
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ttl integer;
  v_inserted integer := 0;
BEGIN
  v_ttl := GREATEST(10, LEAST(COALESCE(p_ttl_seconds, 45), 120));
  DELETE FROM public.search_inflight
  WHERE started_at <= now() - make_interval(secs => v_ttl);

  INSERT INTO public.search_inflight (cache_key, started_at)
  VALUES (p_cache_key, now())
  ON CONFLICT (cache_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_search_inflight(p_cache_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.search_inflight WHERE cache_key = p_cache_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_search_rate_limit(
  p_ip text,
  p_ip_max integer DEFAULT 200,
  p_global_max integer DEFAULT 1500,
  p_window_seconds integer DEFAULT 600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window interval;
  v_ip text;
  v_ip_ok boolean;
  v_global_ok boolean;
BEGIN
  v_window := make_interval(secs => GREATEST(60, LEAST(COALESCE(p_window_seconds, 600), 3600)));
  v_ip := 'catalog-search:ip:' || COALESCE(NULLIF(trim(p_ip), ''), 'unknown');

  DELETE FROM public.rate_limit_buckets
  WHERE window_start <= now() - v_window;

  INSERT INTO public.rate_limit_buckets (bucket_key, window_start, hit_count)
  VALUES (v_ip, now(), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET hit_count = CASE
          WHEN public.rate_limit_buckets.window_start <= now() - v_window THEN 1
          ELSE public.rate_limit_buckets.hit_count + 1
        END,
        window_start = CASE
          WHEN public.rate_limit_buckets.window_start <= now() - v_window THEN now()
          ELSE public.rate_limit_buckets.window_start
        END
  RETURNING hit_count <= GREATEST(1, COALESCE(p_ip_max, 200)) INTO v_ip_ok;

  INSERT INTO public.rate_limit_buckets (bucket_key, window_start, hit_count)
  VALUES ('catalog-search:global', now(), 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET hit_count = CASE
          WHEN public.rate_limit_buckets.window_start <= now() - v_window THEN 1
          ELSE public.rate_limit_buckets.hit_count + 1
        END,
        window_start = CASE
          WHEN public.rate_limit_buckets.window_start <= now() - v_window THEN now()
          ELSE public.rate_limit_buckets.window_start
        END
  RETURNING hit_count <= GREATEST(1, COALESCE(p_global_max, 1500)) INTO v_global_ok;

  RETURN COALESCE(v_ip_ok, true) AND COALESCE(v_global_ok, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.try_acquire_store_slot(
  p_store_id text,
  p_max integer DEFAULT 2
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store text;
  v_max integer;
  v_window timestamptz;
  v_until timestamptz;
  v_count integer;
BEGIN
  v_store := lower(trim(COALESCE(p_store_id, '')));
  IF v_store = '' THEN
    RETURN false;
  END IF;
  v_max := GREATEST(1, LEAST(COALESCE(p_max, 2), 8));
  v_window := date_trunc('minute', now());

  SELECT open_until INTO v_until
  FROM public.store_circuit
  WHERE store_id = v_store;

  IF v_until IS NOT NULL AND v_until > now() THEN
    RETURN false;
  END IF;

  INSERT INTO public.store_fetch_window (store_id, window_start, fetch_count)
  VALUES (v_store, v_window, 1)
  ON CONFLICT (store_id, window_start) DO UPDATE
    SET fetch_count = public.store_fetch_window.fetch_count + 1
    WHERE public.store_fetch_window.fetch_count < v_max
  RETURNING fetch_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_store_fetch_result(
  p_store_id text,
  p_ok boolean,
  p_fail_threshold integer DEFAULT 3,
  p_skip_seconds integer DEFAULT 600
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store text;
  v_threshold integer;
  v_skip integer;
  v_row public.store_circuit%ROWTYPE;
BEGIN
  v_store := lower(trim(COALESCE(p_store_id, '')));
  IF v_store = '' THEN
    RETURN;
  END IF;
  v_threshold := GREATEST(2, LEAST(COALESCE(p_fail_threshold, 3), 10));
  v_skip := GREATEST(60, LEAST(COALESCE(p_skip_seconds, 600), 3600));

  INSERT INTO public.store_circuit (store_id, fail_count, window_start, open_until)
  VALUES (v_store, 0, now(), NULL)
  ON CONFLICT (store_id) DO NOTHING;

  SELECT * INTO v_row FROM public.store_circuit WHERE store_id = v_store;

  IF v_row.window_start <= now() - interval '5 minutes' THEN
    v_row.fail_count := 0;
    v_row.window_start := now();
    IF v_row.open_until IS NOT NULL AND v_row.open_until <= now() THEN
      v_row.open_until := NULL;
    END IF;
  END IF;

  IF p_ok THEN
    v_row.fail_count := 0;
  ELSE
    v_row.fail_count := v_row.fail_count + 1;
    IF v_row.fail_count >= v_threshold THEN
      v_row.open_until := now() + make_interval(secs => v_skip);
      v_row.fail_count := 0;
      v_row.window_start := now();
    END IF;
  END IF;

  UPDATE public.store_circuit
  SET fail_count = v_row.fail_count,
      window_start = v_row.window_start,
      open_until = v_row.open_until
  WHERE store_id = v_store;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_search_query_stat(
  p_query text,
  p_stores text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_stores text[];
  v_key text;
BEGIN
  v_norm := public.normalize_listing_query(p_query);
  IF length(v_norm) < 2 THEN
    RETURN;
  END IF;
  v_stores := ARRAY(
    SELECT DISTINCT trim(lower(s))
    FROM unnest(COALESCE(p_stores, ARRAY[]::text[])) AS s
    WHERE trim(s) <> ''
    ORDER BY 1
  );
  v_key := COALESCE(array_to_string(v_stores, ','), '');

  INSERT INTO public.search_query_stats (query_norm, stores_key, query_raw, stores, hit_count, last_requested_at)
  VALUES (v_norm, v_key, trim(p_query), v_stores, 1, now())
  ON CONFLICT (query_norm, stores_key) DO UPDATE
    SET hit_count = public.search_query_stats.hit_count + 1,
        query_raw = COALESCE(NULLIF(trim(p_query), ''), public.search_query_stats.query_raw),
        stores = EXCLUDED.stores,
        last_requested_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.list_hot_search_queries(
  p_limit integer DEFAULT 15,
  p_stale_minutes integer DEFAULT 30
)
RETURNS TABLE (
  query_raw text,
  query_norm text,
  stores text[],
  hit_count integer,
  last_requested_at timestamptz,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(s.query_raw, ''), s.query_norm) AS query_raw,
    s.query_norm,
    s.stores,
    s.hit_count,
    s.last_requested_at,
    idx.last_seen_at
  FROM public.search_query_stats s
  LEFT JOIN LATERAL (
    SELECT max(li.last_seen_at) AS last_seen_at
    FROM public.listing_index li
    WHERE li.query_norm = s.query_norm
      AND li.expires_at > now()
      AND (
        cardinality(s.stores) = 0
        OR li.store_id = ANY (s.stores)
      )
  ) idx ON true
  WHERE s.last_requested_at > now() - interval '7 days'
    AND (
      idx.last_seen_at IS NULL
      OR idx.last_seen_at <= now() - make_interval(mins => GREATEST(10, LEAST(COALESCE(p_stale_minutes, 30), 720)))
    )
  ORDER BY s.hit_count DESC, s.last_requested_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 15), 40));
$$;

CREATE OR REPLACE FUNCTION public.cleanup_search_scale_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cache integer;
  v_inflight integer;
  v_rate integer;
  v_slots integer;
BEGIN
  DELETE FROM public.search_request_cache WHERE expires_at <= now();
  GET DIAGNOSTICS v_cache = ROW_COUNT;
  DELETE FROM public.search_inflight WHERE started_at <= now() - interval '2 minutes';
  GET DIAGNOSTICS v_inflight = ROW_COUNT;
  DELETE FROM public.rate_limit_buckets WHERE window_start <= now() - interval '30 minutes';
  GET DIAGNOSTICS v_rate = ROW_COUNT;
  DELETE FROM public.store_fetch_window WHERE window_start <= now() - interval '30 minutes';
  GET DIAGNOSTICS v_slots = ROW_COUNT;
  RETURN jsonb_build_object(
    'cache', v_cache,
    'inflight', v_inflight,
    'rate', v_rate,
    'slots', v_slots
  );
END;
$$;

-- FTS-aware listing index search (keeps the existing 3-arg signature).
CREATE OR REPLACE FUNCTION public.search_listing_index(
  p_query text,
  p_stores text[] DEFAULT NULL,
  p_limit integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_limit integer;
  v_tokens text[];
  v_tsquery tsquery;
BEGIN
  v_query := public.normalize_listing_query(p_query);
  IF length(v_query) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 24), 48));
  v_tokens := ARRAY(
    SELECT tok
    FROM unnest(string_to_array(v_query, ' ')) AS tok
    WHERE length(tok) >= 2
  );
  BEGIN
    v_tsquery := plainto_tsquery('simple', v_query);
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := NULL;
  END;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x)::jsonb)
    FROM (
      SELECT
        li.store_id,
        li.external_url,
        li.title,
        li.price_jpy,
        li.currency,
        li.image_url,
        li.image_urls,
        li.tags,
        li.last_seen_at,
        li.expires_at,
        li.query_norm
      FROM public.listing_index li
      WHERE li.expires_at > now()
        AND (p_stores IS NULL OR cardinality(p_stores) = 0 OR li.store_id = ANY (p_stores))
        AND (
          li.query_norm = v_query
          OR (v_tsquery IS NOT NULL AND li.title_search @@ v_tsquery)
          OR (
            cardinality(v_tokens) > 0
            AND (
              SELECT bool_and(position(tok IN lower(li.title)) > 0)
              FROM unnest(v_tokens) AS tok
            )
          )
          OR li.title % v_query
        )
      ORDER BY
        CASE WHEN li.query_norm = v_query THEN 0 ELSE 1 END,
        CASE WHEN v_tsquery IS NOT NULL AND li.title_search @@ v_tsquery THEN 0 ELSE 1 END,
        li.last_seen_at DESC
      LIMIT v_limit
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON TABLE public.search_request_cache FROM PUBLIC;
REVOKE ALL ON TABLE public.search_inflight FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC;
REVOKE ALL ON TABLE public.store_fetch_window FROM PUBLIC;
REVOKE ALL ON TABLE public.store_circuit FROM PUBLIC;
REVOKE ALL ON TABLE public.search_query_stats FROM PUBLIC;

GRANT ALL ON TABLE public.search_request_cache TO service_role;
GRANT ALL ON TABLE public.search_inflight TO service_role;
GRANT ALL ON TABLE public.rate_limit_buckets TO service_role;
GRANT ALL ON TABLE public.store_fetch_window TO service_role;
GRANT ALL ON TABLE public.store_circuit TO service_role;
GRANT ALL ON TABLE public.search_query_stats TO service_role;

REVOKE ALL ON FUNCTION public.get_search_request_cache(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_search_request_cache(text, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_search_inflight(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_search_inflight(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_search_rate_limit(text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_acquire_store_slot(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_store_fetch_result(text, boolean, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_search_query_stat(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_hot_search_queries(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_search_scale_tables() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_search_request_cache(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_search_request_cache(text, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_search_inflight(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_search_inflight(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_search_rate_limit(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_store_slot(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_store_fetch_result(text, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_search_query_stat(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_hot_search_queries(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_search_scale_tables() TO service_role;

-- search_listing_index stays callable by anon (public catalog preview).
GRANT EXECUTE ON FUNCTION public.search_listing_index(text, text[], integer) TO anon, authenticated, service_role;
