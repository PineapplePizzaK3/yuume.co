-- Purchase groups destination: separates Online and Physical cards.

ALTER TABLE public.purchase_groups
  ADD COLUMN IF NOT EXISTS destination TEXT;

ALTER TABLE public.purchase_groups
  DROP CONSTRAINT IF EXISTS purchase_groups_destination_check;

ALTER TABLE public.purchase_groups
  ADD CONSTRAINT purchase_groups_destination_check
  CHECK (destination IS NULL OR destination IN ('online', 'physical'));

COMMENT ON COLUMN public.purchase_groups.destination IS
  'Destino do grupo de Compras Programadas: online ou physical.';

CREATE INDEX IF NOT EXISTS idx_purchase_groups_destination_created_at
  ON public.purchase_groups(destination, created_at DESC);

-- Store URL used for scraping and periodic price refresh.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_url TEXT;

COMMENT ON COLUMN public.products.source_url IS
  'URL de origem do produto para scraping de preço.';

-- Admin: create group with destination.
CREATE OR REPLACE FUNCTION public.admin_create_purchase_group(p_group jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_image_urls jsonb;
  v_product_ids jsonb;
  v_source text;
  v_destination text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_image_urls := COALESCE(p_group->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_image_urls) <> 'array' THEN
    v_image_urls := '[]'::jsonb;
  END IF;

  v_product_ids := COALESCE(p_group->'product_ids', '[]'::jsonb);
  IF jsonb_typeof(v_product_ids) <> 'array' THEN
    v_product_ids := '[]'::jsonb;
  END IF;

  v_source := LOWER(COALESCE(NULLIF(trim(p_group->>'source'), ''), 'scheduled'));
  IF v_source NOT IN ('scheduled', 'showcase') THEN
    RAISE EXCEPTION 'Source inválido';
  END IF;

  v_destination := LOWER(NULLIF(trim(COALESCE(p_group->>'destination', '')), ''));
  IF v_destination IS NOT NULL AND v_destination NOT IN ('online', 'physical') THEN
    RAISE EXCEPTION 'Destino inválido';
  END IF;

  IF (p_group->>'name') IS NULL OR trim(p_group->>'name') = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF jsonb_array_length(v_image_urls) = 0 THEN
    RAISE EXCEPTION 'Fotos (image_urls) são obrigatórias';
  END IF;

  WITH inserted AS (
    INSERT INTO public.purchase_groups (name, description, image_url, image_urls, is_active, product_ids, source, destination, updated_at)
    VALUES (
      trim((p_group->>'name'))::text,
      NULLIF(trim(COALESCE(p_group->>'description','')), '')::text,
      (v_image_urls->>0)::text,
      v_image_urls,
      COALESCE((p_group->>'is_active')::boolean, true),
      v_product_ids,
      v_source,
      v_destination,
      NOW()
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: update group with destination.
CREATE OR REPLACE FUNCTION public.admin_update_purchase_group(p_id uuid, p_group jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_image_urls jsonb;
  v_product_ids jsonb;
  v_source text;
  v_destination text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_image_urls := COALESCE(p_group->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_image_urls) <> 'array' THEN
    v_image_urls := '[]'::jsonb;
  END IF;

  v_product_ids := COALESCE(p_group->'product_ids', '[]'::jsonb);
  IF jsonb_typeof(v_product_ids) <> 'array' THEN
    v_product_ids := '[]'::jsonb;
  END IF;

  v_source := LOWER(COALESCE(NULLIF(trim(p_group->>'source'), ''), 'scheduled'));
  IF v_source NOT IN ('scheduled', 'showcase') THEN
    RAISE EXCEPTION 'Source inválido';
  END IF;

  v_destination := LOWER(NULLIF(trim(COALESCE(p_group->>'destination', '')), ''));
  IF v_destination IS NOT NULL AND v_destination NOT IN ('online', 'physical') THEN
    RAISE EXCEPTION 'Destino inválido';
  END IF;

  IF (p_group->>'name') IS NULL OR trim(p_group->>'name') = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF jsonb_array_length(v_image_urls) = 0 THEN
    RAISE EXCEPTION 'Fotos (image_urls) são obrigatórias';
  END IF;

  WITH updated AS (
    UPDATE public.purchase_groups
    SET
      name = trim((p_group->>'name'))::text,
      description = NULLIF(trim(COALESCE(p_group->>'description','')), '')::text,
      image_url = (v_image_urls->>0)::text,
      image_urls = v_image_urls,
      is_active = COALESCE((p_group->>'is_active')::boolean, true),
      product_ids = v_product_ids,
      source = v_source,
      destination = v_destination,
      updated_at = NOW()
    WHERE id = p_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  RETURN v_result;
END;
$$;

-- Admin: create group product with source URL.
CREATE OR REPLACE FUNCTION public.admin_create_purchase_group_product(
  p_group_id uuid,
  p_product jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_img_url text;
  v_img_urls jsonb;
  v_price_jpy numeric;
  v_source_url text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_groups WHERE id = p_group_id) THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  v_img_url := NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text;
  v_img_urls := COALESCE(p_product->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_img_urls) <> 'array' OR jsonb_array_length(v_img_urls) = 0 THEN
    IF v_img_url IS NOT NULL THEN
      v_img_urls := jsonb_build_array(v_img_url);
    ELSE
      v_img_urls := '[]'::jsonb;
    END IF;
  END IF;

  v_price_jpy := GREATEST(COALESCE((p_product->>'price')::numeric, 0), 0);
  v_source_url := NULLIF(trim(COALESCE(p_product->>'source_url','')), '')::text;

  WITH inserted AS (
    INSERT INTO public.products (
      name, description, price, price_jpy, image_url, image_urls, is_active,
      weight_kg, stock_quantity, purchase_group_id, source_url
    )
    VALUES (
      (p_product->>'name')::text,
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      v_price_jpy,
      v_price_jpy,
      v_img_url,
      v_img_urls,
      true,
      COALESCE((p_product->>'weight_kg')::numeric, 0),
      CASE
        WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = ''
        THEN NULL
        ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
      END,
      p_group_id,
      v_source_url
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: update group product with source URL.
CREATE OR REPLACE FUNCTION public.admin_update_purchase_group_product(
  p_product_id uuid,
  p_group_id uuid,
  p_product jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_img_url text;
  v_img_urls jsonb;
  v_price_jpy numeric;
  v_source_url text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_img_url := NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text;
  v_img_urls := COALESCE(p_product->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_img_urls) <> 'array' OR jsonb_array_length(v_img_urls) = 0 THEN
    IF v_img_url IS NOT NULL THEN
      v_img_urls := jsonb_build_array(v_img_url);
    ELSE
      v_img_urls := '[]'::jsonb;
    END IF;
  END IF;

  v_price_jpy := GREATEST(COALESCE((p_product->>'price')::numeric, 0), 0);
  v_source_url := NULLIF(trim(COALESCE(p_product->>'source_url','')), '')::text;

  WITH updated AS (
    UPDATE public.products
    SET
      name = (p_product->>'name')::text,
      description = NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      price = v_price_jpy,
      price_jpy = v_price_jpy,
      image_url = v_img_url,
      image_urls = v_img_urls,
      weight_kg = COALESCE((p_product->>'weight_kg')::numeric, 0),
      stock_quantity = CASE
        WHEN p_product ? 'stock_quantity' AND (p_product->>'stock_quantity') IS NOT NULL AND trim(COALESCE(p_product->>'stock_quantity','')) <> ''
        THEN GREATEST((p_product->>'stock_quantity')::integer, 0)
        WHEN p_product ? 'stock_quantity'
        THEN NULL
        ELSE stock_quantity
      END,
      source_url = CASE
        WHEN p_product ? 'source_url' THEN v_source_url
        ELSE source_url
      END,
      updated_at = NOW()
    WHERE id = p_product_id AND purchase_group_id = p_group_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  RETURN v_result;
END;
$$;
