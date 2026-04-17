-- Link de referência só para equipe (admin); não exposto em RPC público de grupo.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS admin_product_url TEXT;

COMMENT ON COLUMN public.products.admin_product_url IS
  'URL de referência do produto (somente painel admin; omitida em get_purchase_group_products para clientes).';

-- Lista produtos do grupo: por padrão remove admin_product_url; admins podem pedir o JSON completo.
CREATE OR REPLACE FUNCTION public.get_purchase_group_products(
  p_group_id uuid,
  p_include_staff_fields boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN public.is_admin() AND COALESCE(p_include_staff_fields, false)
          THEN to_jsonb(p)
          ELSE to_jsonb(p) - 'admin_product_url'
        END
        ORDER BY p.created_at
      ),
      '[]'::jsonb
    )
    FROM public.products p
    WHERE p.purchase_group_id = p_group_id AND p.is_active = true
  );
END;
$$;

-- Admin: cria produto do grupo (inclui admin_product_url).
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

  WITH inserted AS (
    INSERT INTO public.products (
      name, description, price, price_jpy, image_url, image_urls, is_active,
      weight_kg, stock_quantity, purchase_group_id, source_url, admin_product_url
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
      v_admin_product_url
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: atualiza produto do grupo.
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
