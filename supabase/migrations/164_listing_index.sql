-- Step 4 foundation: short-TTL listing index of what live search already fetched.
-- Not a crawl. Writes are gated by market_source_allows(..., 'cache', context).
-- C2C legacy sources get 2h (same as ephemeral). API sources use max_cache_hours.
-- Live parse stays the source of truth; the index fills gaps and hydrates temporary pages.

CREATE OR REPLACE FUNCTION public.canonical_listing_url(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := lower(trim(COALESCE(p_url, '')));
  IF v = '' THEN
    RETURN '';
  END IF;
  v := split_part(v, '#', 1);
  v := split_part(v, '?', 1);
  IF v ~ '^https?://' AND right(v, 1) = '/' THEN
    v := left(v, length(v) - 1);
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_listing_query(p_query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(trim(COALESCE(p_query, '')), '\s+', ' ', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.listing_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL,
  canonical_url text NOT NULL,
  external_url text NOT NULL,
  title text NOT NULL,
  price_jpy numeric NOT NULL DEFAULT 0 CHECK (price_jpy >= 0),
  currency text NOT NULL DEFAULT 'JPY',
  image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  query_norm text,
  acquisition text NOT NULL DEFAULT 'live_search'
    CHECK (acquisition IN ('live_search', 'ephemeral', 'api')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, canonical_url)
);

COMMENT ON TABLE public.listing_index IS
  'Short-TTL index of marketplace listings already fetched for a user search or ephemeral open. Gated by market_sources cache permission. Live parse remains the fallback.';

CREATE INDEX IF NOT EXISTS listing_index_live_query_idx
  ON public.listing_index (query_norm, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS listing_index_expires_idx
  ON public.listing_index (expires_at);

CREATE INDEX IF NOT EXISTS listing_index_store_seen_idx
  ON public.listing_index (store_id, last_seen_at DESC);

DROP TRIGGER IF EXISTS listing_index_touch_updated_at ON public.listing_index;
CREATE TRIGGER listing_index_touch_updated_at
  BEFORE UPDATE ON public.listing_index
  FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.listing_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listing_index_public_read_live ON public.listing_index;
CREATE POLICY listing_index_public_read_live ON public.listing_index
  FOR SELECT
  USING (expires_at > now());

REVOKE INSERT, UPDATE, DELETE ON public.listing_index FROM anon, authenticated;
GRANT SELECT ON public.listing_index TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.listing_index TO service_role;

CREATE OR REPLACE FUNCTION public.listing_index_cache_ttl(p_store_id text)
RETURNS interval
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours integer;
BEGIN
  SELECT max_cache_hours INTO v_hours
  FROM public.market_sources
  WHERE id = p_store_id;
  IF v_hours IS NOT NULL AND v_hours > 0 THEN
    RETURN make_interval(hours => LEAST(v_hours, 24 * 7));
  END IF;
  -- Legacy C2C search may cache what was already shown, matching ephemeral TTL.
  RETURN interval '2 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_listing_index(
  p_rows jsonb,
  p_query text DEFAULT NULL,
  p_context text DEFAULT 'legacy_public',
  p_acquisition text DEFAULT 'live_search'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_store text;
  v_url text;
  v_canonical text;
  v_title text;
  v_price numeric;
  v_currency text;
  v_image text;
  v_images text[];
  v_tags text[];
  v_query text;
  v_context text;
  v_acquisition text;
  v_ttl interval;
  v_count integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN 0;
  END IF;

  v_query := public.normalize_listing_query(p_query);
  v_context := CASE
    WHEN p_context IN ('legacy_public', 'legacy_admin', 'collector', 'snapshot_job') THEN p_context
    ELSE 'legacy_public'
  END;
  v_acquisition := CASE
    WHEN p_acquisition IN ('live_search', 'ephemeral', 'api') THEN p_acquisition
    ELSE 'live_search'
  END;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_store := NULLIF(trim(COALESCE(v_item->>'storeId', v_item->>'store_id', '')), '');
    v_url := NULLIF(trim(COALESCE(v_item->>'productUrl', v_item->>'external_url', '')), '');
    v_canonical := public.canonical_listing_url(v_url);
    v_title := NULLIF(trim(COALESCE(v_item->>'title', '')), '');
    IF v_store IS NULL OR v_canonical = '' OR v_title IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT public.market_source_allows(v_store, 'cache', v_context) THEN
      CONTINUE;
    END IF;

    v_price := COALESCE((v_item->>'price')::numeric, (v_item->>'price_jpy')::numeric, 0);
    IF v_price < 0 THEN
      v_price := 0;
    END IF;
    v_currency := COALESCE(NULLIF(trim(COALESCE(v_item->>'currency', 'JPY')), ''), 'JPY');
    v_image := NULLIF(trim(COALESCE(v_item->>'imageUrl', v_item->>'image_url', '')), '');
    v_images := ARRAY(
      SELECT DISTINCT trim(x)
      FROM (
        SELECT jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(v_item->'imageUrls') = 'array' THEN v_item->'imageUrls'
            WHEN jsonb_typeof(v_item->'image_urls') = 'array' THEN v_item->'image_urls'
            ELSE '[]'::jsonb
          END
        ) AS x
      ) s
      WHERE trim(x) ~* '^https?://'
    );
    IF v_image IS NOT NULL AND NOT (v_image = ANY (v_images)) THEN
      v_images := array_prepend(v_image, v_images);
    END IF;
    v_tags := ARRAY(
      SELECT DISTINCT trim(x)
      FROM (
        SELECT jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(v_item->'tags') = 'array' THEN v_item->'tags' ELSE '[]'::jsonb END
        ) AS x
      ) s
      WHERE trim(x) <> ''
    );
    v_ttl := public.listing_index_cache_ttl(v_store);

    INSERT INTO public.listing_index AS idx (
      store_id, canonical_url, external_url, title, price_jpy, currency,
      image_url, image_urls, tags, query_norm, acquisition, last_seen_at, expires_at
    ) VALUES (
      v_store, v_canonical, v_url, v_title, v_price, v_currency,
      COALESCE(v_image, v_images[1]), v_images, v_tags,
      NULLIF(v_query, ''), v_acquisition, now(), now() + v_ttl
    )
    ON CONFLICT (store_id, canonical_url) DO UPDATE
    SET
      external_url = EXCLUDED.external_url,
      title = EXCLUDED.title,
      price_jpy = EXCLUDED.price_jpy,
      currency = EXCLUDED.currency,
      image_url = COALESCE(EXCLUDED.image_url, idx.image_url),
      image_urls = CASE
        WHEN cardinality(EXCLUDED.image_urls) > 0 THEN EXCLUDED.image_urls
        ELSE idx.image_urls
      END,
      tags = CASE
        WHEN cardinality(EXCLUDED.tags) > 0 THEN EXCLUDED.tags
        ELSE idx.tags
      END,
      query_norm = COALESCE(NULLIF(EXCLUDED.query_norm, ''), idx.query_norm),
      acquisition = EXCLUDED.acquisition,
      last_seen_at = now(),
      expires_at = GREATEST(idx.expires_at, EXCLUDED.expires_at),
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

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
          OR (
            cardinality(v_tokens) > 0
            AND (
              SELECT bool_and(position(tok IN lower(li.title)) > 0)
              FROM unnest(v_tokens) AS tok
            )
          )
        )
      ORDER BY
        CASE WHEN li.query_norm = v_query THEN 0 ELSE 1 END,
        li.last_seen_at DESC
      LIMIT v_limit
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_listing_index_by_url(
  p_store_id text,
  p_url text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canonical text;
  v_row public.listing_index%ROWTYPE;
BEGIN
  v_canonical := public.canonical_listing_url(p_url);
  IF v_canonical = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.listing_index
  WHERE canonical_url = v_canonical
    AND expires_at > now()
    AND (p_store_id IS NULL OR trim(p_store_id) = '' OR store_id = trim(p_store_id))
  ORDER BY last_seen_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'store_id', v_row.store_id,
    'external_url', v_row.external_url,
    'title', v_row.title,
    'price_jpy', v_row.price_jpy,
    'currency', v_row.currency,
    'image_url', v_row.image_url,
    'image_urls', to_jsonb(v_row.image_urls),
    'tags', to_jsonb(v_row.tags),
    'expires_at', v_row.expires_at,
    'last_seen_at', v_row.last_seen_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_listing_index()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.listing_index
  WHERE expires_at <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_index_sync_from_ephemeral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_available AND NEW.expires_at > now() THEN
    PERFORM public.upsert_listing_index(
      jsonb_build_array(jsonb_build_object(
        'storeId', NEW.store_id,
        'productUrl', NEW.external_url,
        'title', NEW.title,
        'price', COALESCE(NEW.current_price_jpy, NEW.snapshot_price_jpy),
        'currency', NEW.currency,
        'imageUrl', COALESCE(NEW.current_image_url, NEW.image_url),
        'imageUrls', COALESCE(NEW.raw_payload->'imageUrls', '[]'::jsonb)
      )),
      NULLIF(trim(COALESCE(NEW.raw_payload->>'query', NEW.raw_payload->'sourcePayload'->>'title', '')), ''),
      'legacy_public',
      'ephemeral'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_index_from_ephemeral ON public.ephemeral_products;
CREATE TRIGGER listing_index_from_ephemeral
  AFTER INSERT OR UPDATE OF title, snapshot_price_jpy, current_price_jpy, image_url, current_image_url, raw_payload, expires_at, is_available
  ON public.ephemeral_products
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_index_sync_from_ephemeral();

REVOKE ALL ON FUNCTION public.listing_index_cache_ttl(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.upsert_listing_index(jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_listing_index(jsonb, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.search_listing_index(text, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_listing_index(text, text[], integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_listing_index_by_url(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_index_by_url(text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.cleanup_expired_listing_index() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_listing_index() TO service_role;

GRANT EXECUTE ON FUNCTION public.canonical_listing_url(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_listing_query(text) TO anon, authenticated, service_role;

-- Rollback:
--   DROP TRIGGER IF EXISTS listing_index_from_ephemeral ON public.ephemeral_products;
--   DROP FUNCTION IF EXISTS public.listing_index_sync_from_ephemeral();
--   DROP FUNCTION IF EXISTS public.cleanup_expired_listing_index();
--   DROP FUNCTION IF EXISTS public.get_listing_index_by_url(text, text);
--   DROP FUNCTION IF EXISTS public.search_listing_index(text, text[], integer);
--   DROP FUNCTION IF EXISTS public.upsert_listing_index(jsonb, text, text, text);
--   DROP FUNCTION IF EXISTS public.listing_index_cache_ttl(text);
--   DROP TABLE IF EXISTS public.listing_index;
--   DROP FUNCTION IF EXISTS public.normalize_listing_query(text);
--   DROP FUNCTION IF EXISTS public.canonical_listing_url(text);
