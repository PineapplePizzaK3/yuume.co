-- Step 11: recommendation candidate RPC (no recommendations table).
-- Pure ranking lives in src/lib/recommendations; this RPC only assembles bounded inputs.

CREATE OR REPLACE FUNCTION public.service_collector_recommendation_candidates(p_limit integer DEFAULT 80)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 80), 1), 200);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para ver recomendações.';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        -- Wishlist candidates
        SELECT
          'wishlist'::text AS candidate_kind,
          wi.catalog_item_id,
          ci.set_id,
          s.set_code,
          s.name_ja AS set_name_ja,
          s.name_en AS set_name_en,
          s.status AS set_status,
          ci.number,
          ci.name_ja,
          ci.name_en,
          ci.rarity,
          wi.target_price_jpy,
          snap.best_price_jpy,
          snap.median_price_jpy,
          snap.listing_count,
          snap.previous_listing_count,
          snap.first_available_at,
          snap.match_quality,
          snap.checked_at,
          snap.best_url,
          snap.source_id,
          false AS is_owned,
          EXISTS (
            SELECT 1 FROM public.user_inventory ui
            WHERE ui.user_id = v_user_id
              AND ui.catalog_item_id = wi.catalog_item_id
              AND ui.status IN ('stored', 'ready_for_shipment')
          ) AS is_held,
          EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.user_id = v_user_id
              AND o.catalog_item_id = wi.catalog_item_id
              AND o.status NOT IN ('completed', 'rejected', 'cancelled')
          ) AS in_active_order
        FROM public.wishlist_items wi
        JOIN public.catalog_items ci ON ci.id = wi.catalog_item_id
        LEFT JOIN public.catalog_sets s ON s.id = ci.set_id
        LEFT JOIN LATERAL (
          SELECT *
          FROM public.market_snapshots_valid v
          WHERE v.catalog_item_id = wi.catalog_item_id
          ORDER BY v.checked_at DESC
          LIMIT 1
        ) snap ON true
        WHERE wi.user_id = v_user_id
          AND NOT EXISTS (
            SELECT 1 FROM public.collection_items col
            WHERE col.user_id = v_user_id AND col.catalog_item_id = wi.catalog_item_id AND col.status = 'owned'
          )

        UNION ALL

        -- Missing from tracked VERIFIED sets
        SELECT
          'missing'::text,
          ci.id,
          ci.set_id,
          s.set_code,
          s.name_ja,
          s.name_en,
          s.status,
          ci.number,
          ci.name_ja,
          ci.name_en,
          ci.rarity,
          NULL::numeric,
          snap.best_price_jpy,
          snap.median_price_jpy,
          snap.listing_count,
          snap.previous_listing_count,
          snap.first_available_at,
          snap.match_quality,
          snap.checked_at,
          snap.best_url,
          snap.source_id,
          false,
          EXISTS (
            SELECT 1 FROM public.user_inventory ui
            WHERE ui.user_id = v_user_id
              AND ui.catalog_item_id = ci.id
              AND ui.status IN ('stored', 'ready_for_shipment')
          ),
          EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.user_id = v_user_id
              AND o.catalog_item_id = ci.id
              AND o.status NOT IN ('completed', 'rejected', 'cancelled')
          )
        FROM public.tracked_sets t
        JOIN public.catalog_sets s ON s.id = t.set_id AND s.status = 'VERIFIED'
        JOIN public.catalog_items ci ON ci.set_id = s.id AND ci.in_checklist IS TRUE
        LEFT JOIN LATERAL (
          SELECT *
          FROM public.market_snapshots_valid v
          WHERE v.catalog_item_id = ci.id
          ORDER BY v.checked_at DESC
          LIMIT 1
        ) snap ON true
        WHERE t.user_id = v_user_id
          AND NOT EXISTS (
            SELECT 1 FROM public.collection_items col
            WHERE col.user_id = v_user_id AND col.catalog_item_id = ci.id AND col.status = 'owned'
          )

        LIMIT v_limit
      ) r
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_collector_recommendation_candidates(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_collector_recommendation_candidates(integer) TO authenticated, service_role;

-- Rollback:
--   DROP FUNCTION IF EXISTS public.service_collector_recommendation_candidates(integer);
