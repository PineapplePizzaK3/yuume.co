CREATE OR REPLACE FUNCTION public.get_public_product_by_id(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  SELECT
    (to_jsonb(p) - 'admin_product_url')
    || jsonb_build_object(
      'price_jpy', COALESCE(vr.min_price_jpy, p.price_jpy, p.price, 0),
      'variants', COALESCE(vr.variants, '[]'::jsonb)
    )
  INTO v_payload
  FROM public.products p
  LEFT JOIN LATERAL (
    SELECT
      MIN(pv.price_jpy) FILTER (WHERE pv.is_active = true) AS min_price_jpy,
      jsonb_agg(to_jsonb(pv) ORDER BY pv.is_default DESC, pv.created_at ASC) FILTER (WHERE pv.is_active = true) AS variants
    FROM public.product_variants pv
    WHERE pv.product_id = p.id
  ) vr ON true
  WHERE p.id = p_product_id
    AND p.is_active = true
    AND (
      EXISTS (SELECT 1 FROM public.store_products sp WHERE sp.product_id = p.id AND sp.is_active = true)
      OR (
        p.purchase_group_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.purchase_groups g WHERE g.id = p.purchase_group_id AND g.is_active = true)
      )
    )
  LIMIT 1;

  RETURN v_payload;
END;
$$;

