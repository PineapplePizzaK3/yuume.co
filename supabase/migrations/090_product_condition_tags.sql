-- Product condition tags for Virtual Shop (and catalog)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_condition text;

UPDATE public.products
SET item_condition = 'new'
WHERE item_condition IS NULL OR trim(item_condition) = '';

ALTER TABLE public.products
  ALTER COLUMN item_condition SET DEFAULT 'new',
  ALTER COLUMN item_condition SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_item_condition_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_item_condition_check
  CHECK (item_condition IN ('new', 'sealed', 'used', 'refurbished', 'for_parts'));

-- Admin: criar produto-base
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

  WITH inserted AS (
    INSERT INTO public.products (name, description, price, price_jpy, image_url, image_urls, is_active, weight_kg, stock_quantity, item_condition)
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
      v_item_condition
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;

  RETURN v_result;
END;
$$;

-- Admin: atualizar produto-base
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
