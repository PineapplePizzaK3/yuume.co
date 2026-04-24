-- Compras Programadas: suporte real a variantes (modelo only-variants).
-- - create/update de produto de grupo passa a sincronizar product_variants.
-- - get_purchase_group_products retorna variantes agregadas (com opção staff).

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
  v_category text;
  v_variants jsonb;
  v_product_id uuid;
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
  v_category := NULLIF(trim(COALESCE(p_product->>'category','')), '')::text;
  v_variants := COALESCE(p_product->'variants', '[]'::jsonb);

  IF jsonb_typeof(v_variants) <> 'array' OR jsonb_array_length(v_variants) = 0 THEN
    v_variants := jsonb_build_array(
      jsonb_build_object(
        'title', COALESCE(NULLIF(trim(COALESCE(p_product->>'name','')), ''), 'Padrão'),
        'attributes', jsonb_build_object(
          'versao', COALESCE(NULLIF(trim(COALESCE(p_product->>'name','')), ''), 'Padrão'),
          'item_condition', COALESCE(NULLIF(trim(COALESCE(p_product->>'item_condition','')), ''), 'new'),
          'category', v_category,
          'description', NULLIF(trim(COALESCE(p_product->>'description','')), ''),
          'admin_product_url', NULLIF(trim(COALESCE(p_product->>'admin_product_url','')), '')
        ),
        'sku', NULL,
        'image_url', v_img_url,
        'image_urls', v_img_urls,
        'price_jpy', v_price_jpy,
        'stock_quantity',
          CASE
            WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = ''
            THEN NULL
            ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
          END,
        'is_active', true,
        'is_default', true
      )
    );
  END IF;

  WITH inserted AS (
    INSERT INTO public.products (
      name, description, price, price_jpy, image_url, image_urls, is_active,
      weight_kg, stock_quantity, purchase_group_id, source_url, category, item_condition
    )
    VALUES (
      COALESCE(NULLIF(trim(COALESCE(p_product->>'name','')), ''), 'Produto sem nome'),
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      v_price_jpy,
      v_price_jpy,
      v_img_url,
      v_img_urls,
      true,
      GREATEST(COALESCE((p_product->>'weight_kg')::numeric, 0), 0),
      CASE
        WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = ''
        THEN NULL
        ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
      END,
      p_group_id,
      v_source_url,
      v_category,
      COALESCE(NULLIF(trim(COALESCE(p_product->>'item_condition','')), ''), 'new')
    )
    RETURNING *
  )
  SELECT i.id, to_jsonb(i) INTO v_product_id, v_result FROM inserted i;

  PERFORM public.admin_sync_product_variants(v_product_id, v_variants);

  -- Parent deriva preço/estoque/imagem da variante padrão para manter compatibilidade legada.
  UPDATE public.products p
  SET
    price = COALESCE(v.price_jpy, p.price),
    price_jpy = COALESCE(v.price_jpy, p.price_jpy),
    image_url = COALESCE(v.image_url, p.image_url),
    image_urls = CASE
      WHEN jsonb_typeof(v.image_urls) = 'array' AND jsonb_array_length(v.image_urls) > 0 THEN v.image_urls
      WHEN v.image_url IS NOT NULL THEN jsonb_build_array(v.image_url)
      ELSE p.image_urls
    END,
    stock_quantity = v.stock_quantity,
    updated_at = now()
  FROM public.product_variants v
  WHERE p.id = v_product_id
    AND v.product_id = p.id
    AND v.is_default = true;

  SELECT
    to_jsonb(p)
    || jsonb_build_object(
      'variants',
      COALESCE(
        (
          SELECT jsonb_agg(to_jsonb(vx) ORDER BY vx.is_default DESC, vx.created_at ASC)
          FROM public.product_variants vx
          WHERE vx.product_id = p.id
        ),
        '[]'::jsonb
      )
    )
  INTO v_result
  FROM public.products p
  WHERE p.id = v_product_id;

  RETURN v_result;
END;
$$;

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
  v_category text;
  v_variants jsonb;
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
  v_category := NULLIF(trim(COALESCE(p_product->>'category','')), '')::text;
  v_variants := COALESCE(p_product->'variants', '[]'::jsonb);

  IF jsonb_typeof(v_variants) <> 'array' OR jsonb_array_length(v_variants) = 0 THEN
    v_variants := jsonb_build_array(
      jsonb_build_object(
        'title', COALESCE(NULLIF(trim(COALESCE(p_product->>'name','')), ''), 'Padrão'),
        'attributes', jsonb_build_object(
          'versao', COALESCE(NULLIF(trim(COALESCE(p_product->>'name','')), ''), 'Padrão'),
          'item_condition', COALESCE(NULLIF(trim(COALESCE(p_product->>'item_condition','')), ''), 'new'),
          'category', v_category,
          'description', NULLIF(trim(COALESCE(p_product->>'description','')), ''),
          'admin_product_url', NULLIF(trim(COALESCE(p_product->>'admin_product_url','')), '')
        ),
        'sku', NULL,
        'image_url', v_img_url,
        'image_urls', v_img_urls,
        'price_jpy', v_price_jpy,
        'stock_quantity',
          CASE
            WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = ''
            THEN NULL
            ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
          END,
        'is_active', true,
        'is_default', true
      )
    );
  END IF;

  WITH updated AS (
    UPDATE public.products
    SET
      name = COALESCE(NULLIF(trim(COALESCE(p_product->>'name','')), ''), name),
      description = CASE WHEN p_product ? 'description' THEN NULLIF(trim(COALESCE(p_product->>'description','')), '')::text ELSE description END,
      price = v_price_jpy,
      price_jpy = v_price_jpy,
      image_url = v_img_url,
      image_urls = v_img_urls,
      weight_kg = GREATEST(COALESCE((p_product->>'weight_kg')::numeric, 0), 0),
      stock_quantity = CASE
        WHEN p_product ? 'stock_quantity' AND (p_product->>'stock_quantity') IS NOT NULL AND trim(COALESCE(p_product->>'stock_quantity','')) <> ''
        THEN GREATEST((p_product->>'stock_quantity')::integer, 0)
        WHEN p_product ? 'stock_quantity'
        THEN NULL
        ELSE stock_quantity
      END,
      source_url = CASE WHEN p_product ? 'source_url' THEN v_source_url ELSE source_url END,
      category = CASE WHEN p_product ? 'category' THEN v_category ELSE category END,
      item_condition = CASE
        WHEN p_product ? 'item_condition'
        THEN COALESCE(NULLIF(trim(COALESCE(p_product->>'item_condition','')), ''), 'new')
        ELSE item_condition
      END,
      updated_at = NOW()
    WHERE id = p_product_id AND purchase_group_id = p_group_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  PERFORM public.admin_sync_product_variants(p_product_id, v_variants);

  UPDATE public.products p
  SET
    price = COALESCE(v.price_jpy, p.price),
    price_jpy = COALESCE(v.price_jpy, p.price_jpy),
    image_url = COALESCE(v.image_url, p.image_url),
    image_urls = CASE
      WHEN jsonb_typeof(v.image_urls) = 'array' AND jsonb_array_length(v.image_urls) > 0 THEN v.image_urls
      WHEN v.image_url IS NOT NULL THEN jsonb_build_array(v.image_url)
      ELSE p.image_urls
    END,
    stock_quantity = v.stock_quantity,
    updated_at = now()
  FROM public.product_variants v
  WHERE p.id = p_product_id
    AND v.product_id = p.id
    AND v.is_default = true;

  SELECT
    to_jsonb(p)
    || jsonb_build_object(
      'variants',
      COALESCE(
        (
          SELECT jsonb_agg(to_jsonb(vx) ORDER BY vx.is_default DESC, vx.created_at ASC)
          FROM public.product_variants vx
          WHERE vx.product_id = p.id
        ),
        '[]'::jsonb
      )
    )
  INTO v_result
  FROM public.products p
  WHERE p.id = p_product_id;

  RETURN v_result;
END;
$$;

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
        (
          CASE
            WHEN public.is_admin() AND COALESCE(p_include_staff_fields, false) THEN to_jsonb(p)
            ELSE to_jsonb(p) - 'admin_product_url'
          END
        )
        || jsonb_build_object(
          'price_jpy', COALESCE(vr.min_price_jpy, p.price_jpy, p.price, 0),
          'variants', COALESCE(vr.variants, '[]'::jsonb)
        )
        ORDER BY p.created_at
      ),
      '[]'::jsonb
    )
    FROM public.products p
    LEFT JOIN LATERAL (
      SELECT
        MIN(pv.price_jpy) FILTER (WHERE pv.is_active = true) AS min_price_jpy,
        jsonb_agg(
          CASE
            WHEN public.is_admin() AND COALESCE(p_include_staff_fields, false) THEN to_jsonb(pv)
            ELSE jsonb_set(
              to_jsonb(pv),
              '{attributes}',
              COALESCE((to_jsonb(pv)->'attributes'), '{}'::jsonb) - 'admin_product_url'
            )
          END
          ORDER BY pv.is_default DESC, pv.created_at ASC
        ) FILTER (WHERE pv.is_active = true) AS variants
      FROM public.product_variants pv
      WHERE pv.product_id = p.id
    ) vr ON true
    WHERE p.purchase_group_id = p_group_id
      AND p.is_active = true
  );
END;
$$;

