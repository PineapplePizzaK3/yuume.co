-- Múltiplas fotos por produto (loja virtual)
-- image_url permanece como primeira/capa; image_urls = array de URLs (JSONB)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.image_urls IS 'Array de URLs de fotos do produto, ex: ["url1", "url2"]';

-- Migrar image_url existente para image_urls se vazio
UPDATE public.products
SET image_urls = jsonb_build_array(image_url)
WHERE (image_urls IS NULL OR image_urls = '[]'::jsonb) AND image_url IS NOT NULL AND trim(image_url) <> '';

-- RPCs atualizados para aceitar e retornar image_urls
CREATE OR REPLACE FUNCTION public.admin_create_product(p_product jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_img_url text;
  v_img_urls jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  v_img_url := NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text;
  v_img_urls := COALESCE(p_product->'image_urls', '[]'::jsonb);
  IF jsonb_array_length(v_img_urls) = 0 AND v_img_url IS NOT NULL THEN
    v_img_urls := jsonb_build_array(v_img_url);
  END IF;
  WITH inserted AS (
    INSERT INTO public.products (name, description, price, image_url, image_urls, is_active)
    VALUES (
      (p_product->>'name')::text,
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      (p_product->>'price')::numeric,
      v_img_url,
      v_img_urls,
      COALESCE((p_product->>'is_active')::boolean, true)
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_product(p_id uuid, p_product jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_img_url text;
  v_img_urls jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  v_img_url := NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text;
  v_img_urls := COALESCE(p_product->'image_urls', '[]'::jsonb);
  IF jsonb_array_length(v_img_urls) = 0 AND v_img_url IS NOT NULL THEN
    v_img_urls := jsonb_build_array(v_img_url);
  END IF;
  WITH updated AS (
    UPDATE public.products
    SET
      name = (p_product->>'name')::text,
      description = NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      price = (p_product->>'price')::numeric,
      image_url = v_img_url,
      image_urls = v_img_urls,
      is_active = COALESCE((p_product->>'is_active')::boolean, true),
      updated_at = NOW()
    WHERE id = p_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  RETURN v_result;
END;
$$;
