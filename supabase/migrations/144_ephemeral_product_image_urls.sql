-- A busca externa passa a guardar todas as fotos do anúncio no payload.
-- A leitura pública devolve essa lista para a galeria da página temporária.

CREATE OR REPLACE FUNCTION public.get_public_ephemeral_product(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ephemeral_products%ROWTYPE;
  v_price_jpy numeric;
  v_unit_usd numeric;
  v_unit_brl numeric;
  v_image_urls jsonb;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.ephemeral_products
  WHERE token = trim(p_token)
    AND expires_at > now()
    AND is_available = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_price_jpy := COALESCE(v_row.current_price_jpy, v_row.snapshot_price_jpy);
  v_unit_usd := public.compute_product_unit_sale_usd(v_price_jpy, 'store');
  v_unit_brl := public.compute_product_unit_sale_brl(v_price_jpy, 'store');
  v_image_urls := CASE
    WHEN jsonb_typeof(v_row.raw_payload->'imageUrls') = 'array' THEN v_row.raw_payload->'imageUrls'
    WHEN jsonb_typeof(v_row.raw_payload->'sourcePayload'->'imageUrls') = 'array' THEN v_row.raw_payload->'sourcePayload'->'imageUrls'
    ELSE '[]'::jsonb
  END;

  RETURN jsonb_build_object(
    'token', v_row.token,
    'store_id', v_row.store_id,
    'external_url', v_row.external_url,
    'title', COALESCE(v_row.current_title, v_row.title),
    'price_jpy', v_price_jpy,
    'price_usd', v_unit_usd,
    'unit_sale_brl', v_unit_brl,
    'currency', v_row.currency,
    'image_url', COALESCE(v_row.current_image_url, v_row.image_url),
    'image_urls', v_image_urls,
    'expires_at', v_row.expires_at,
    'is_available', v_row.is_available
  );
END;
$$;
