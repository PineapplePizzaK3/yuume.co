-- Extend public market_sources projection for Find-in-Japan (Step 8).
-- Only expose search/purchase flags when the source is enabled AND cleared.

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
    'can_search_automated', s.enabled AND s.review_status = 'cleared' AND s.can_search_automated,
    'can_display_price', s.enabled AND s.review_status = 'cleared' AND s.can_display_price,
    'can_purchase_sourcing', s.enabled AND s.review_status = 'cleared' AND s.can_purchase_sourcing,
    'search_url_template', CASE WHEN s.enabled AND s.can_link THEN s.search_url_template ELSE NULL END,
    'attribution_text', s.attribution_text,
    'legacy_automation_allowed', s.enabled AND s.legacy_automation_allowed
  ) ORDER BY s.id), '[]'::jsonb)
  FROM public.market_sources s;
$$;

GRANT EXECUTE ON FUNCTION public.service_market_sources_public() TO anon, authenticated, service_role;

-- Rollback:
--   Restore body from 151_market_sources_registry.sql (without can_search_automated / can_display_price / can_purchase_sourcing).
