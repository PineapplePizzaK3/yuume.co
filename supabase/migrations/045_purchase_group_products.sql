-- Produtos específicos do grupo de compras (criados pelo admin dentro do grupo)
-- Substitui product_ids: produtos são criados no grupo, não selecionados da loja

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_group_id UUID REFERENCES public.purchase_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_products_purchase_group_id ON public.products(purchase_group_id);

-- Loja: exclui produtos de grupo (apenas produtos da loja virtual)
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

-- Admin: cria produto dentro de um grupo
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

  WITH inserted AS (
    INSERT INTO public.products (
      name, description, price, image_url, image_urls, is_active,
      weight_kg, stock_quantity, purchase_group_id
    )
    VALUES (
      (p_product->>'name')::text,
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      (p_product->>'price')::numeric,
      v_img_url,
      v_img_urls,
      true,
      COALESCE((p_product->>'weight_kg')::numeric, 0),
      CASE
        WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = ''
        THEN NULL
        ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
      END,
      p_group_id
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: atualiza produto do grupo
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

  WITH updated AS (
    UPDATE public.products
    SET
      name = (p_product->>'name')::text,
      description = NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      price = (p_product->>'price')::numeric,
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

-- Admin: remove produto do grupo
CREATE OR REPLACE FUNCTION public.admin_delete_purchase_group_product(
  p_product_id uuid,
  p_group_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.products
  WHERE id = p_product_id AND purchase_group_id = p_group_id;
END;
$$;

-- Admin: lista grupos com contagem de produtos
CREATE OR REPLACE FUNCTION public.admin_list_purchase_groups()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(g)::jsonb), '[]'::jsonb)
    FROM (
      SELECT pg.*,
        (SELECT COUNT(*)::int FROM public.products p WHERE p.purchase_group_id = pg.id) AS products_count
      FROM public.purchase_groups pg
      ORDER BY pg.created_at DESC
    ) g
  );
END;
$$;

-- Admin: lista apenas produtos da loja (exclui produtos de grupo)
CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
    FROM (
      SELECT * FROM public.products
      WHERE purchase_group_id IS NULL
      ORDER BY created_at DESC
    ) p
  );
END;
$$;

-- Lista produtos de um grupo (público para página de grupo de compras)
CREATE OR REPLACE FUNCTION public.get_purchase_group_products(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at), '[]'::jsonb)
    FROM public.products p
    WHERE p.purchase_group_id = p_group_id AND p.is_active = true
  );
END;
$$;
