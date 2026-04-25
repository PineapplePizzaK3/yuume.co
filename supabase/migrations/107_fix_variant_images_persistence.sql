-- Corrige persistência estrutural de imagens por variante.
-- Problema observado: image_urls chegava como null/string JSON e a sync salvava null.
-- Resultado: apenas a primeira variante parecia ter imagem.

-- 1) Normaliza dados já existentes.
UPDATE public.product_variants
SET image_urls = CASE
  WHEN jsonb_typeof(image_urls) = 'array' THEN image_urls
  WHEN image_url IS NOT NULL AND trim(image_url) <> '' THEN jsonb_build_array(trim(image_url))
  ELSE '[]'::jsonb
END;

UPDATE public.product_variants
SET image_url = COALESCE(
  NULLIF(trim(image_url), ''),
  NULLIF(trim(COALESCE(image_urls->>0, '')), '')
);

ALTER TABLE public.product_variants
  ALTER COLUMN image_urls SET DEFAULT '[]'::jsonb;

UPDATE public.product_variants
SET image_urls = '[]'::jsonb
WHERE image_urls IS NULL;

ALTER TABLE public.product_variants
  ALTER COLUMN image_urls SET NOT NULL;

-- 2) Fortalece a função central de sync das variantes.
CREATE OR REPLACE FUNCTION public.admin_sync_product_variants(
  p_product_id uuid,
  p_variants jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_count int := 0;
  v_img_url text;
  v_img_urls jsonb;
  v_img_urls_text text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos uma variante';
  END IF;

  DELETE FROM public.product_variants WHERE product_id = p_product_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_variants)
  LOOP
    v_count := v_count + 1;

    v_img_url := NULLIF(trim(COALESCE(v_item->>'image_url', '')), '');
    v_img_urls := COALESCE(v_item->'image_urls', '[]'::jsonb);

    -- Permite payload legado onde image_urls vem como string JSON: "[...]"
    IF jsonb_typeof(v_img_urls) = 'string' THEN
      v_img_urls_text := NULLIF(trim(COALESCE(v_item->>'image_urls', '')), '');
      IF v_img_urls_text IS NOT NULL AND left(v_img_urls_text, 1) = '[' THEN
        BEGIN
          v_img_urls := v_img_urls_text::jsonb;
        EXCEPTION
          WHEN others THEN
            v_img_urls := '[]'::jsonb;
        END;
      ELSE
        v_img_urls := '[]'::jsonb;
      END IF;
    END IF;

    IF jsonb_typeof(v_img_urls) <> 'array' THEN
      v_img_urls := '[]'::jsonb;
    END IF;

    -- Mantém consistência: se só há capa, cria array; se só há array, define capa pela 1a.
    IF jsonb_array_length(v_img_urls) = 0 AND v_img_url IS NOT NULL THEN
      v_img_urls := jsonb_build_array(v_img_url);
    END IF;

    IF v_img_url IS NULL AND jsonb_array_length(v_img_urls) > 0 THEN
      v_img_url := NULLIF(trim(COALESCE(v_img_urls->>0, '')), '');
    END IF;

    INSERT INTO public.product_variants (
      product_id,
      title,
      attributes,
      sku,
      image_url,
      image_urls,
      price_jpy,
      stock_quantity,
      is_active,
      is_default
    )
    VALUES (
      p_product_id,
      NULLIF(trim(COALESCE(v_item->>'title', '')), ''),
      CASE
        WHEN jsonb_typeof(v_item->'attributes') = 'object' THEN v_item->'attributes'
        ELSE '{}'::jsonb
      END,
      NULLIF(trim(COALESCE(v_item->>'sku', '')), ''),
      v_img_url,
      v_img_urls,
      GREATEST(COALESCE((v_item->>'price_jpy')::numeric, 0), 0),
      CASE
        WHEN (v_item ? 'stock_quantity') AND trim(COALESCE(v_item->>'stock_quantity', '')) <> '' THEN GREATEST((v_item->>'stock_quantity')::integer, 0)
        ELSE NULL
      END,
      COALESCE((v_item->>'is_active')::boolean, true),
      COALESCE((v_item->>'is_default')::boolean, (v_count = 1))
    );
  END LOOP;

  UPDATE public.product_variants
  SET is_default = (id = (
    SELECT id
    FROM public.product_variants
    WHERE product_id = p_product_id
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1
  ))
  WHERE product_id = p_product_id;
END;
$$;
