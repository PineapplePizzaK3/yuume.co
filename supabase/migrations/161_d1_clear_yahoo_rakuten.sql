-- D1 (2026-09-27): owner cleared Yahoo! Shopping Item Search v3 and Rakuten Ichiba Item Search
-- for commercial search, in-product price display (with required credit), and aggregate cache.
-- Does not authorize HTML scraping, Rakuma, or Yahoo Auctions.

UPDATE public.market_sources
SET
  review_status = 'cleared',
  terms_reviewed_at = COALESCE(terms_reviewed_at, now()),
  notes = CASE id
    WHEN 'yahoo_shopping' THEN
      'D1 cleared 2026-09-27: commercial search, price display with Yahoo credit, aggregate cache within API terms. Honor is_cross_border_agency (D8).'
    WHEN 'rakuten_ichiba' THEN
      'D1 cleared 2026-09-27: commercial search, price display with Rakuten credit, aggregate cache within API terms. Ichiba only; Rakuma excluded.'
    ELSE notes
  END
WHERE id IN ('yahoo_shopping', 'rakuten_ichiba');

-- Rollback:
--   UPDATE public.market_sources
--   SET review_status = 'in_review', terms_reviewed_at = NULL
--   WHERE id IN ('yahoo_shopping', 'rakuten_ichiba');
