-- Compatibilidade: garante colunas de imagem em product_variants.
-- Necessário para funções que promovem dados da variante padrão ao produto pai.

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS image_urls jsonb;

UPDATE public.product_variants
SET image_urls = '[]'::jsonb
WHERE image_urls IS NULL
   OR jsonb_typeof(image_urls) <> 'array';

UPDATE public.product_variants
SET image_url = NULLIF(trim(COALESCE(image_url, image_urls->>0, '')), '')
WHERE image_url IS NULL
  AND jsonb_typeof(image_urls) = 'array'
  AND jsonb_array_length(image_urls) > 0;

