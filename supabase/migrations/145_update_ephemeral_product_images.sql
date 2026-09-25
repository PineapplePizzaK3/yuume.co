-- Atualiza a galeria de fotos de um produto efêmero após scrape em background.

CREATE OR REPLACE FUNCTION public.update_ephemeral_product_images(
  p_token text,
  p_image_urls jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ephemeral_products%ROWTYPE;
  v_urls jsonb := '[]'::jsonb;
  v_cover text;
  v_item text;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  IF jsonb_typeof(p_image_urls) = 'array' THEN
    FOR v_item IN
      SELECT value
      FROM jsonb_array_elements_text(p_image_urls) AS t(value)
    LOOP
      v_item := NULLIF(trim(v_item), '');
      IF v_item IS NULL THEN
        CONTINUE;
      END IF;
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_urls) AS existing(value)
        WHERE existing.value = v_item
      ) THEN
        CONTINUE;
      END IF;
      v_urls := v_urls || jsonb_build_array(v_item);
      IF jsonb_array_length(v_urls) >= 24 THEN
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_urls) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_images');
  END IF;

  v_cover := NULLIF(trim(v_urls->>0), '');

  UPDATE public.ephemeral_products
  SET
    image_url = COALESCE(v_cover, image_url),
    current_image_url = COALESCE(v_cover, current_image_url, image_url),
    raw_payload = COALESCE(raw_payload, '{}'::jsonb)
      || jsonb_build_object(
        'imageUrl', COALESCE(v_cover, raw_payload->>'imageUrl'),
        'imageUrls', v_urls
      )
  WHERE token = trim(p_token)
    AND expires_at > now()
    AND is_available = true
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_row.token,
    'image_url', COALESCE(v_row.current_image_url, v_row.image_url),
    'image_urls', v_urls
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_ephemeral_product_images(text, jsonb) TO anon, authenticated;
