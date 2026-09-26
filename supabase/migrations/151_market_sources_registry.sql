-- Market source permission registry (Collector Platform, Step 2).
-- Records what YuumeCo may search / display / cache / link / purchase-source / automate per source,
-- so any source can be switched off from the database without a deployment.
-- Seed values follow docs/sources/source-rights-audit.md. Existing adapters keep today's behavior through
-- the legacy_* flags until owner decision D4.

CREATE TABLE IF NOT EXISTS public.market_sources (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  source_type text NOT NULL,
  can_search_automated boolean NOT NULL DEFAULT false,
  can_display_price boolean NOT NULL DEFAULT false,
  can_display_images boolean NOT NULL DEFAULT false,
  max_cache_hours integer NOT NULL DEFAULT 0,
  can_link boolean NOT NULL DEFAULT true,
  can_purchase_sourcing boolean NOT NULL DEFAULT false,
  can_automate_snapshots boolean NOT NULL DEFAULT false,
  legacy_search_allowed boolean NOT NULL DEFAULT false,
  legacy_automation_allowed boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'unreviewed',
  terms_url text,
  terms_reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  attribution_text text,
  rate_limit_per_min integer,
  search_url_template text,
  hosts text[] NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_sources_id_format CHECK (id ~ '^[a-z0-9_]+$'),
  CONSTRAINT market_sources_source_type_valid CHECK (source_type IN (
    'api', 'partner', 'affiliate', 'own_data', 'permitted_automation',
    'manual_sourcing', 'link_out_only', 'prohibited_automation'
  )),
  CONSTRAINT market_sources_review_status_valid CHECK (review_status IN (
    'unreviewed', 'in_review', 'cleared', 'rejected'
  )),
  CONSTRAINT market_sources_cache_non_negative CHECK (max_cache_hours >= 0),
  CONSTRAINT market_sources_rate_limit_positive CHECK (rate_limit_per_min IS NULL OR rate_limit_per_min > 0),
  CONSTRAINT market_sources_search_template_has_query CHECK (
    search_url_template IS NULL OR position('{query}' IN search_url_template) > 0
  )
);

COMMENT ON TABLE public.market_sources IS
  'Per-source permissions (search, display, cache, link, purchase/sourcing, automate). Source of truth: docs/sources/source-rights-audit.md.';
COMMENT ON COLUMN public.market_sources.legacy_search_allowed IS
  'Grandfathered automated search for legacy features (public/admin catalog search, scrape-product) pending decision D4. Never applies to collector contexts.';
COMMENT ON COLUMN public.market_sources.legacy_automation_allowed IS
  'Grandfathered scheduled jobs (e.g. SNKRDUNK catalog scripts) pending decision D4. Set false to stop them without a deploy.';

DROP TRIGGER IF EXISTS trg_market_sources_touch_updated_at ON public.market_sources;
CREATE TRIGGER trg_market_sources_touch_updated_at
BEFORE UPDATE ON public.market_sources
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.market_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_sources_admin_read" ON public.market_sources;
CREATE POLICY "market_sources_admin_read"
  ON public.market_sources
  FOR SELECT
  USING (public.is_admin());

-- Seed. ids for the six existing catalog-search adapters must match their StoreId values.
-- Only own_stock is 'cleared'; API sources stay 'in_review' until decision D1.
INSERT INTO public.market_sources (
  id, display_name, source_type,
  can_search_automated, can_display_price, can_display_images, max_cache_hours,
  can_link, can_purchase_sourcing, can_automate_snapshots,
  legacy_search_allowed, legacy_automation_allowed,
  review_status, terms_url, notes, attribution_text, rate_limit_per_min, search_url_template, hosts
) VALUES
  ('own_stock', 'YuumeCo', 'own_data',
    true, true, true, 24,
    true, true, true,
    false, false,
    'cleared', NULL, 'First-party store products.', NULL, NULL, NULL, ARRAY[]::text[]),
  ('yahoo_shopping', 'Yahoo!ショッピング', 'api',
    true, true, true, 24,
    true, true, true,
    false, false,
    'in_review', 'https://developer.yahoo.co.jp/webapi/shopping/v3/itemsearch.html',
    'Item Search v3. Requires app ID, guideline agreement and credit display. Honor is_cross_border_agency (D8). Pending D1.',
    'Web Services by Yahoo! JAPAN', 30, 'https://shopping.yahoo.co.jp/search?p={query}',
    ARRAY['shopping.yahoo.co.jp', 'store.shopping.yahoo.co.jp']),
  ('rakuten_ichiba', '楽天市場', 'api',
    true, true, true, 24,
    true, true, true,
    false, false,
    'in_review', 'https://webservice.rakuten.co.jp/documentation/ichiba-item-search',
    'Rakuten Ichiba Item Search API. Excludes C2C. Pending D1 (data-use and refresh rules).',
    'Supported by Rakuten Developers', NULL, 'https://search.rakuten.co.jp/search/mall/{query}/',
    ARRAY['item.rakuten.co.jp', 'search.rakuten.co.jp', 'www.rakuten.co.jp']),
  ('amazon', 'Amazon.co.jp', 'link_out_only',
    false, false, false, 0,
    true, true, false,
    true, false,
    'in_review', 'https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction',
    'Legacy adapter scrapes HTML. Upgrade to api only via Creators API after Associates eligibility (D2).',
    NULL, NULL, 'https://www.amazon.co.jp/s?k={query}',
    ARRAY['www.amazon.co.jp', 'amazon.co.jp', 'amzn.asia']),
  ('mercari', 'メルカリ', 'link_out_only',
    false, false, false, 0,
    true, true, false,
    true, false,
    'in_review', 'https://static.jp.mercari.com/seller_terms',
    'No public C2C API. Legacy adapter uses web scraping and a private app API (mercariApi.ts). Pursue partner program.',
    NULL, NULL, 'https://jp.mercari.com/search?keyword={query}',
    ARRAY['jp.mercari.com', 'mercari.com', 'item.mercari.com']),
  ('yahoo', 'Yahoo!オークション', 'link_out_only',
    false, false, false, 0,
    true, true, false,
    true, false,
    'in_review', 'https://auctions.yahoo.co.jp/special/html/guidelines.html',
    'Auction Web API closed in 2020. Legacy adapter scrapes HTML.',
    NULL, NULL, 'https://auctions.yahoo.co.jp/search/search?p={query}',
    ARRAY['auctions.yahoo.co.jp', 'page.auctions.yahoo.co.jp']),
  ('yahoo_flea', 'Yahoo!フリマ', 'link_out_only',
    false, false, false, 0,
    true, true, false,
    true, false,
    'in_review', NULL,
    'No public API found. Legacy adapter scrapes HTML.',
    NULL, NULL, 'https://paypayfleamarket.yahoo.co.jp/search/{query}',
    ARRAY['paypayfleamarket.yahoo.co.jp']),
  ('rakuma', 'ラクマ', 'link_out_only',
    false, false, false, 0,
    true, true, false,
    true, false,
    'in_review', NULL,
    'Not covered by Rakuten Ichiba API. Legacy adapter scrapes HTML with r.jina.ai fallback.',
    NULL, NULL, 'https://fril.jp/s?query={query}',
    ARRAY['fril.jp', 'item.fril.jp']),
  ('snkrdunk', 'SNKRDUNK', 'prohibited_automation',
    false, false, false, 0,
    true, true, false,
    true, true,
    'rejected', 'https://snkrdunk.com/terms',
    'Terms Art. 7-13 prohibit crawling/scraping. Legacy search adapter and catalog scripts grandfathered pending D4.',
    NULL, NULL, 'https://snkrdunk.com/search?keywords={query}',
    ARRAY['snkrdunk.com']),
  ('surugaya', '駿河屋', 'affiliate',
    false, false, false, 0,
    true, true, false,
    false, false,
    'in_review', 'https://www.suruga-ya.jp/affiliate_new/af_kiyaku.html',
    'Affiliate links only; no public feed or API.',
    NULL, NULL, 'https://www.suruga-ya.jp/search?search_word={query}',
    ARRAY['www.suruga-ya.jp', 'suruga-ya.jp']),
  ('cardrush', 'カードラッシュ', 'link_out_only',
    false, false, false, 0,
    true, true, false,
    false, false,
    'unreviewed', NULL,
    'No API found. Automation only with written permission.',
    NULL, NULL, NULL,
    ARRAY['www.cardrush-pokemon.jp', 'cardrush-pokemon.jp'])
ON CONFLICT (id) DO NOTHING;

-- Single policy function shared by edge functions, snapshot writers and recommendation RPCs.
-- Contexts: legacy_public | legacy_admin | collector | snapshot_job
-- Operations: search | display_price | display_images | cache | link | purchase_sourcing | snapshot | automation
CREATE OR REPLACE FUNCTION public.market_source_allows(
  p_source text,
  p_operation text,
  p_context text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.market_sources%ROWTYPE;
  v_legacy boolean := p_context IN ('legacy_public', 'legacy_admin');
BEGIN
  SELECT * INTO v_row FROM public.market_sources WHERE id = p_source;
  IF NOT FOUND OR NOT v_row.enabled THEN
    RETURN false;
  END IF;

  -- review_status governs automation; a user-opened link or staff purchase is allowed whenever the flag is on.
  IF p_operation = 'link' THEN
    RETURN v_row.can_link;
  END IF;

  IF p_operation = 'purchase_sourcing' THEN
    RETURN v_row.can_purchase_sourcing;
  END IF;

  IF v_legacy THEN
    RETURN CASE p_operation
      WHEN 'search' THEN v_row.can_search_automated OR v_row.legacy_search_allowed
      WHEN 'display_price' THEN v_row.can_display_price OR v_row.legacy_search_allowed
      WHEN 'display_images' THEN v_row.can_display_images OR v_row.legacy_search_allowed
      WHEN 'cache' THEN v_row.max_cache_hours > 0 OR v_row.legacy_search_allowed
      WHEN 'automation' THEN v_row.can_automate_snapshots OR v_row.legacy_automation_allowed
      ELSE false
    END;
  END IF;

  IF p_context NOT IN ('collector', 'snapshot_job') OR v_row.review_status <> 'cleared' THEN
    RETURN false;
  END IF;

  RETURN CASE p_operation
    WHEN 'search' THEN v_row.can_search_automated
    WHEN 'display_price' THEN v_row.can_display_price
    WHEN 'display_images' THEN v_row.can_display_images
    WHEN 'cache' THEN v_row.max_cache_hours > 0
    WHEN 'snapshot' THEN v_row.can_automate_snapshots AND v_row.max_cache_hours > 0
    WHEN 'automation' THEN v_row.can_automate_snapshots
    ELSE false
  END;
END;
$$;

-- Non-sensitive projection for the frontend (link-outs, attribution) and CI scripts (kill switch).
CREATE OR REPLACE FUNCTION public.service_market_sources_public()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'display_name', s.display_name,
    'source_type', s.source_type,
    'enabled', s.enabled,
    'review_status', s.review_status,
    'can_link', s.can_link AND s.enabled,
    'search_url_template', CASE WHEN s.enabled THEN s.search_url_template ELSE NULL END,
    'attribution_text', s.attribution_text,
    'legacy_automation_allowed', s.enabled AND s.legacy_automation_allowed
  ) ORDER BY s.id), '[]'::jsonb)
  FROM public.market_sources s;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_market_sources()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.market_sources s),
    '[]'::jsonb
  );
END;
$$;

-- Patch-style update. Only whitelisted keys are applied; missing keys keep their current value.
CREATE OR REPLACE FUNCTION public.admin_market_source_update(
  p_source_id text,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_patch jsonb := COALESCE(p_patch, '{}'::jsonb);
  v_row public.market_sources%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_row FROM public.market_sources WHERE id = p_source_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fonte não encontrada: %', p_source_id;
  END IF;

  UPDATE public.market_sources SET
    display_name = COALESCE(NULLIF(trim(v_patch->>'display_name'), ''), display_name),
    source_type = COALESCE(v_patch->>'source_type', source_type),
    can_search_automated = COALESCE((v_patch->>'can_search_automated')::boolean, can_search_automated),
    can_display_price = COALESCE((v_patch->>'can_display_price')::boolean, can_display_price),
    can_display_images = COALESCE((v_patch->>'can_display_images')::boolean, can_display_images),
    max_cache_hours = COALESCE((v_patch->>'max_cache_hours')::integer, max_cache_hours),
    can_link = COALESCE((v_patch->>'can_link')::boolean, can_link),
    can_purchase_sourcing = COALESCE((v_patch->>'can_purchase_sourcing')::boolean, can_purchase_sourcing),
    can_automate_snapshots = COALESCE((v_patch->>'can_automate_snapshots')::boolean, can_automate_snapshots),
    legacy_search_allowed = COALESCE((v_patch->>'legacy_search_allowed')::boolean, legacy_search_allowed),
    legacy_automation_allowed = COALESCE((v_patch->>'legacy_automation_allowed')::boolean, legacy_automation_allowed),
    enabled = COALESCE((v_patch->>'enabled')::boolean, enabled),
    review_status = COALESCE(v_patch->>'review_status', review_status),
    terms_url = CASE WHEN v_patch ? 'terms_url' THEN NULLIF(trim(v_patch->>'terms_url'), '') ELSE terms_url END,
    notes = CASE WHEN v_patch ? 'notes' THEN v_patch->>'notes' ELSE notes END,
    attribution_text = CASE WHEN v_patch ? 'attribution_text' THEN NULLIF(trim(v_patch->>'attribution_text'), '') ELSE attribution_text END,
    rate_limit_per_min = CASE WHEN v_patch ? 'rate_limit_per_min' THEN (NULLIF(v_patch->>'rate_limit_per_min', ''))::integer ELSE rate_limit_per_min END,
    search_url_template = CASE WHEN v_patch ? 'search_url_template' THEN NULLIF(trim(v_patch->>'search_url_template'), '') ELSE search_url_template END,
    terms_reviewed_at = CASE WHEN v_patch ? 'review_status' AND v_patch->>'review_status' IS DISTINCT FROM review_status THEN now() ELSE terms_reviewed_at END,
    reviewed_by = CASE WHEN v_patch ? 'review_status' AND v_patch->>'review_status' IS DISTINCT FROM review_status THEN auth.uid() ELSE reviewed_by END,
    updated_by = auth.uid()
  WHERE id = p_source_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.market_source_allows(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_source_allows(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_market_sources_public() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_market_sources() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_market_source_update(text, jsonb) TO authenticated, service_role;

-- Rollback (manual):
--   DROP FUNCTION IF EXISTS public.admin_market_source_update(text, jsonb);
--   DROP FUNCTION IF EXISTS public.admin_list_market_sources();
--   DROP FUNCTION IF EXISTS public.service_market_sources_public();
--   DROP FUNCTION IF EXISTS public.market_source_allows(text, text, text);
--   DROP TABLE IF EXISTS public.market_sources;
-- Edge functions fall back to legacy behavior when the registry is unreadable, so rollback does not break
-- legacy search; collector contexts fail closed.
