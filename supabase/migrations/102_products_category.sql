-- Categoria livre por produto (catálogo e grupos) + RPC admin para sugestões.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN public.products.category IS
  'Rótulo de categoria definido pelo admin; usado para agrupar na vitrine e em estoque.';

CREATE INDEX IF NOT EXISTS idx_products_category_lower
  ON public.products (lower(trim(category)))
  WHERE category IS NOT NULL AND trim(category) <> '';

-- Admin: lista nomes de categorias já usados (distinct, ordenado).
CREATE OR REPLACE FUNCTION public.admin_list_product_categories()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(x.name ORDER BY x.name), '[]'::jsonb)
    FROM (
      SELECT DISTINCT trim(category) AS name
      FROM public.products
      WHERE category IS NOT NULL AND trim(category) <> ''
    ) x
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_product_categories() TO authenticated;

-- Admin: criar produto-base (inclui category).
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
  v_price_jpy numeric;
  v_item_condition text;
  v_category text;
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
  v_item_condition := lower(trim(COALESCE(p_product->>'item_condition', '')));
  IF v_item_condition NOT IN ('new', 'sealed', 'used', 'refurbished', 'for_parts') THEN
    v_item_condition := 'new';
  END IF;

  v_category := NULLIF(trim(COALESCE(p_product->>'category','')), '')::text;

  WITH inserted AS (
    INSERT INTO public.products (
      name, description, price, price_jpy, image_url, image_urls, is_active,
      weight_kg, stock_quantity, item_condition, category
    )
    VALUES (
      (p_product->>'name')::text,
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      v_price_jpy,
      v_price_jpy,
      v_img_url,
      v_img_urls,
      COALESCE((p_product->>'is_active')::boolean, true),
      COALESCE((p_product->>'weight_kg')::numeric, 0),
      CASE
        WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = ''
        THEN NULL
        ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
      END,
      v_item_condition,
      v_category
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;

  RETURN v_result;
END;
$$;

-- Admin: atualizar produto-base (inclui category).
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
  v_price_jpy numeric;
  v_item_condition text;
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
  v_item_condition := lower(trim(COALESCE(p_product->>'item_condition', '')));
  IF v_item_condition NOT IN ('new', 'sealed', 'used', 'refurbished', 'for_parts') THEN
    v_item_condition := 'new';
  END IF;

  WITH updated AS (
    UPDATE public.products
    SET
      name = (p_product->>'name')::text,
      description = NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      price = v_price_jpy,
      price_jpy = v_price_jpy,
      image_url = v_img_url,
      image_urls = v_img_urls,
      is_active = COALESCE((p_product->>'is_active')::boolean, true),
      weight_kg = COALESCE((p_product->>'weight_kg')::numeric, 0),
      stock_quantity = CASE
        WHEN p_product ? 'stock_quantity' AND (p_product->>'stock_quantity') IS NOT NULL AND trim(COALESCE(p_product->>'stock_quantity','')) <> ''
        THEN GREATEST((p_product->>'stock_quantity')::integer, 0)
        WHEN p_product ? 'stock_quantity'
        THEN NULL
        ELSE stock_quantity
      END,
      item_condition = CASE
        WHEN p_product ? 'item_condition' THEN v_item_condition
        ELSE item_condition
      END,
      category = CASE
        WHEN p_product ? 'category' THEN NULLIF(trim(COALESCE(p_product->>'category','')), '')::text
        ELSE category
      END,
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

-- Admin: cria produto do grupo (inclui category).
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
  v_admin_product_url text;
  v_category text;
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
  v_admin_product_url := NULLIF(trim(COALESCE(p_product->>'admin_product_url','')), '')::text;
  v_category := NULLIF(trim(COALESCE(p_product->>'category','')), '')::text;

  WITH inserted AS (
    INSERT INTO public.products (
      name, description, price, price_jpy, image_url, image_urls, is_active,
      weight_kg, stock_quantity, purchase_group_id, source_url, admin_product_url, category
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
      v_source_url,
      v_admin_product_url,
      v_category
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: atualiza produto do grupo (inclui category).
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
  v_admin_product_url text;
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
  v_admin_product_url := NULLIF(trim(COALESCE(p_product->>'admin_product_url','')), '')::text;

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
      admin_product_url = CASE
        WHEN p_product ? 'admin_product_url' THEN v_admin_product_url
        ELSE admin_product_url
      END,
      category = CASE
        WHEN p_product ? 'category' THEN NULLIF(trim(COALESCE(p_product->>'category','')), '')::text
        ELSE category
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
