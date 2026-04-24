-- MVP de variantes de produto (atributos flexíveis, preço/estoque por variante)

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  title text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  sku text,
  image_url text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_jpy numeric NOT NULL DEFAULT 0 CHECK (price_jpy >= 0),
  stock_quantity integer CHECK (stock_quantity IS NULL OR stock_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_active
  ON public.product_variants(product_id, is_active, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_sku
  ON public.product_variants(sku)
  WHERE sku IS NOT NULL AND trim(sku) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_default_per_product
  ON public.product_variants(product_id)
  WHERE is_default = true;

CREATE OR REPLACE FUNCTION public.set_product_variants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.set_product_variants_updated_at();

INSERT INTO public.product_variants (
  product_id, title, attributes, sku, image_url, image_urls, price_jpy, stock_quantity, is_active, is_default
)
SELECT
  p.id,
  'Padrão',
  jsonb_build_object('versao', 'Padrão'),
  NULL,
  p.image_url,
  COALESCE(p.image_urls, CASE WHEN p.image_url IS NOT NULL AND trim(p.image_url) <> '' THEN jsonb_build_array(p.image_url) ELSE '[]'::jsonb END),
  GREATEST(COALESCE(p.price_jpy, p.price, 0), 0),
  p.stock_quantity,
  COALESCE(p.is_active, true),
  true
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id
);

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE;

UPDATE public.cart_items ci
SET variant_id = v.id
FROM public.product_variants v
WHERE ci.variant_id IS NULL
  AND v.product_id = ci.product_id
  AND v.is_default = true;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_variant
  ON public.cart_items(user_id, variant_id)
  WHERE variant_id IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_title text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_attributes jsonb;

UPDATE public.order_items oi
SET
  variant_id = v.id,
  variant_title = COALESCE(v.title, 'Padrão'),
  variant_attributes = COALESCE(v.attributes, '{}'::jsonb)
FROM public.product_variants v
WHERE oi.variant_id IS NULL
  AND v.product_id = oi.product_id
  AND v.is_default = true;

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
      COALESCE(v_item->'attributes', '{}'::jsonb),
      NULLIF(trim(COALESCE(v_item->>'sku', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'image_url', '')), ''),
      COALESCE(v_item->'image_urls', CASE WHEN NULLIF(trim(COALESCE(v_item->>'image_url', '')), '') IS NOT NULL THEN jsonb_build_array(NULLIF(trim(COALESCE(v_item->>'image_url', '')), '')) ELSE '[]'::jsonb END),
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
  v_product_id uuid;
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

  INSERT INTO public.products (name, description, price, price_jpy, image_url, image_urls, is_active, weight_kg, stock_quantity, item_condition, category, admin_product_url)
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
      WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = '' THEN NULL
      ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
    END,
    NULLIF(trim(COALESCE(p_product->>'item_condition', '')), ''),
    NULLIF(trim(COALESCE(p_product->>'category', '')), ''),
    NULLIF(trim(COALESCE(p_product->>'admin_product_url', '')), '')
  )
  RETURNING id INTO v_product_id;

  v_variants := p_product->'variants';
  IF v_variants IS NOT NULL AND jsonb_typeof(v_variants) = 'array' AND jsonb_array_length(v_variants) > 0 THEN
    PERFORM public.admin_sync_product_variants(v_product_id, v_variants);
  ELSE
    INSERT INTO public.product_variants (product_id, title, attributes, image_url, image_urls, price_jpy, stock_quantity, is_active, is_default)
    VALUES (
      v_product_id,
      'Padrão',
      jsonb_build_object('versao', 'Padrão'),
      v_img_url,
      v_img_urls,
      v_price_jpy,
      CASE
        WHEN (p_product->>'stock_quantity') IS NULL OR trim(COALESCE(p_product->>'stock_quantity','')) = '' THEN NULL
        ELSE GREATEST((p_product->>'stock_quantity')::integer, 0)
      END,
      true,
      true
    );
  END IF;

  SELECT to_jsonb(p.*) || jsonb_build_object(
    'variants',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(v) ORDER BY v.is_default DESC, v.created_at ASC)
      FROM public.product_variants v
      WHERE v.product_id = p.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.products p
  WHERE p.id = v_product_id;

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
  v_price_jpy numeric;
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
      WHEN p_product ? 'stock_quantity' AND trim(COALESCE(p_product->>'stock_quantity','')) <> '' THEN GREATEST((p_product->>'stock_quantity')::integer, 0)
      WHEN p_product ? 'stock_quantity' THEN NULL
      ELSE stock_quantity
    END,
    item_condition = NULLIF(trim(COALESCE(p_product->>'item_condition', '')), ''),
    category = NULLIF(trim(COALESCE(p_product->>'category', '')), ''),
    admin_product_url = NULLIF(trim(COALESCE(p_product->>'admin_product_url', '')), ''),
    updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  v_variants := p_product->'variants';
  IF v_variants IS NOT NULL AND jsonb_typeof(v_variants) = 'array' AND jsonb_array_length(v_variants) > 0 THEN
    PERFORM public.admin_sync_product_variants(p_id, v_variants);
  END IF;

  SELECT to_jsonb(p.*) || jsonb_build_object(
    'variants',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(v) ORDER BY v.is_default DESC, v.created_at ASC)
      FROM public.product_variants v
      WHERE v.product_id = p.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.products p
  WHERE p.id = p_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_store_products(
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 500), 1), 5000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(x.item), '[]'::jsonb)
    FROM (
      SELECT
        to_jsonb(pr.*) || jsonb_build_object(
          'price_jpy', COALESCE(v.min_price_jpy, pr.price_jpy, pr.price, 0),
          'variants', COALESCE(v.variants, '[]'::jsonb)
        ) AS item
      FROM public.store_products sp
      JOIN public.products pr ON pr.id = sp.product_id
      LEFT JOIN LATERAL (
        SELECT
          MIN(pv.price_jpy) FILTER (WHERE pv.is_active = true) AS min_price_jpy,
          jsonb_agg(to_jsonb(pv) ORDER BY pv.is_default DESC, pv.created_at ASC) FILTER (WHERE pv.is_active = true) AS variants
        FROM public.product_variants pv
        WHERE pv.product_id = pr.id
      ) v ON true
      WHERE sp.is_active = true
        AND pr.is_active = true
        AND pr.purchase_group_id IS NULL
      ORDER BY sp.sort_order ASC, sp.created_at DESC, pr.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) x
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_product_by_id(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT
    (to_jsonb(p) - 'admin_product_url')
    || jsonb_build_object(
      'price_jpy', COALESCE(vr.min_price_jpy, p.price_jpy, p.price, 0),
      'variants', COALESCE(vr.variants, '[]'::jsonb)
    )
  INTO v
  FROM public.products p
  LEFT JOIN LATERAL (
    SELECT
      MIN(v.price_jpy) FILTER (WHERE v.is_active = true) AS min_price_jpy,
      jsonb_agg(to_jsonb(v) ORDER BY v.is_default DESC, v.created_at ASC) FILTER (WHERE v.is_active = true) AS variants
    FROM public.product_variants v
    WHERE v.product_id = p.id
  ) vr ON true
  WHERE p.id = p_product_id
    AND p.is_active = true
    AND (
      EXISTS (SELECT 1 FROM public.store_products sp WHERE sp.product_id = p.id AND sp.is_active = true)
      OR (
        p.purchase_group_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.purchase_groups g WHERE g.id = p.purchase_group_id AND g.is_active = true)
      )
    )
  LIMIT 1;

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_products(
  p_limit int DEFAULT 1000,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 1000), 1), 5000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    FROM (
      SELECT
        to_jsonb(pr.*) || jsonb_build_object(
          'store_linked',
          EXISTS (
            SELECT 1
            FROM public.store_products sp
            WHERE sp.product_id = pr.id AND sp.is_active = true
          ),
          'variants',
          COALESCE((
            SELECT jsonb_agg(to_jsonb(v) ORDER BY v.is_default DESC, v.created_at ASC)
            FROM public.product_variants v
            WHERE v.product_id = pr.id
          ), '[]'::jsonb)
        ) AS item
      FROM public.products pr
      ORDER BY pr.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) x
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_store_checkout_intent(
  p_user_id uuid,
  p_ship_immediately boolean DEFAULT false,
  p_shipping_cost numeric DEFAULT NULL,
  p_shipping_currency text DEFAULT 'JPY',
  p_shipping_address_id uuid DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_total_brl numeric := 0;
  v_total_usd numeric := 0;
  v_lines jsonb := '[]'::jsonb;
  v_intent_id uuid;
  v_jpy_usd numeric;
  v_jpy_usd_eff numeric;
  v_usd_brl numeric;
  v_markup numeric;
  v_line_usd numeric;
  v_discount numeric := 0;
  v_coupon_id uuid;
  v_coupon_result jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_shipping_address_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.addresses a
    WHERE a.id = p_shipping_address_id AND a.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Endereço inválido';
  END IF;

  v_jpy_usd := GREATEST(0.0000001, public.get_setting_number('fx_jpy_usd', 0.0066));
  v_usd_brl := GREATEST(0.0001, public.get_setting_number('fx_usd_brl', 5.50));
  v_markup := GREATEST(0, public.get_setting_number('wise_usd_jpy_withdrawal_markup_percent', 0.73));
  v_jpy_usd_eff := v_jpy_usd * (1 + v_markup / 100.0);

  FOR v_item IN
    SELECT
      ci.quantity,
      p.id AS product_id,
      pv.id AS variant_id,
      p.purchase_group_id,
      p.name AS product_name,
      pv.title AS variant_title,
      pv.attributes,
      COALESCE(pv.price_jpy, p.price_jpy, p.price, 0) AS price_jpy,
      pv.stock_quantity
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id AND pv.product_id = p.id
    LEFT JOIN public.store_products sp ON sp.product_id = p.id AND sp.is_active = true
    WHERE ci.user_id = p_user_id
      AND (p.purchase_group_id IS NOT NULL OR sp.product_id IS NOT NULL)
  LOOP
    IF v_item.variant_id IS NULL THEN
      SELECT id, title, attributes, COALESCE(price_jpy, 0), stock_quantity
      INTO v_item.variant_id, v_item.variant_title, v_item.attributes, v_item.price_jpy, v_item.stock_quantity
      FROM public.product_variants
      WHERE product_id = v_item.product_id
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1;
    END IF;

    IF v_item.variant_id IS NULL THEN
      RAISE EXCEPTION 'Produto "%" sem variante ativa', v_item.product_name;
    END IF;

    IF v_item.stock_quantity IS NOT NULL AND v_item.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Variante "%" sem estoque suficiente', COALESCE(v_item.variant_title, v_item.product_name);
    END IF;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_item.product_id,
      'variant_id', v_item.variant_id,
      'variant_title', COALESCE(v_item.variant_title, 'Padrão'),
      'variant_attributes', COALESCE(v_item.attributes, '{}'::jsonb),
      'quantity', v_item.quantity,
      'price_jpy', ROUND(v_item.price_jpy::numeric, 2)
    ));

    v_line_usd := v_item.price_jpy * v_jpy_usd_eff;
    v_total_usd := v_total_usd + (v_line_usd * v_item.quantity);
  END LOOP;

  IF jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio ou inválido';
  END IF;

  v_total_brl := ROUND((v_total_usd * v_usd_brl)::numeric, 2);

  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    v_coupon_result := public.validate_coupon(trim(p_coupon_code), v_total_brl);
    IF (v_coupon_result->>'valid')::boolean = true THEN
      v_coupon_id := (v_coupon_result->>'coupon_id')::uuid;
      v_discount := LEAST((v_coupon_result->>'discount_brl')::numeric, v_total_brl);
    ELSE
      RAISE EXCEPTION '%', v_coupon_result->>'error';
    END IF;
  END IF;

  v_total_brl := GREATEST(ROUND((v_total_brl - v_discount)::numeric, 2), 0);
  v_total_usd := CASE WHEN v_usd_brl > 0 THEN ROUND((v_total_brl / v_usd_brl)::numeric, 4) ELSE v_total_usd END;

  INSERT INTO public.store_checkout_intents (
    user_id, ship_immediately, shipping_cost_jpy, shipping_currency, shipping_address_id,
    coupon_id, discount_amount, total_amount, total_amount_usd, charge_jpy, line_items
  ) VALUES (
    p_user_id, p_ship_immediately, CASE WHEN p_ship_immediately THEN p_shipping_cost ELSE NULL END, p_shipping_currency, p_shipping_address_id,
    v_coupon_id, CASE WHEN v_discount > 0 THEN v_discount ELSE NULL END, v_total_brl, v_total_usd,
    GREATEST(public.brl_to_jpy_for_store_charge(v_total_brl), 1),
    v_lines
  )
  RETURNING id INTO v_intent_id;

  RETURN jsonb_build_object(
    'intent_id', v_intent_id,
    'total_amount', v_total_brl,
    'total_amount_usd', v_total_usd,
    'charge_jpy', public.brl_to_jpy_for_store_charge(v_total_brl),
    'discount_amount', v_discount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.store_intent_materialize_order(p_intent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent public.store_checkout_intents%ROWTYPE;
  v_line RECORD;
  v_order_id uuid;
  v_stock int;
  v_name text;
BEGIN
  SELECT * INTO v_intent
  FROM public.store_checkout_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intenção de checkout não encontrada';
  END IF;
  IF v_intent.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Intenção de checkout já utilizada';
  END IF;
  IF v_intent.expires_at < now() THEN
    RAISE EXCEPTION 'Intenção de checkout expirada. Refaça o checkout.';
  END IF;

  FOR v_line IN
    SELECT
      (e.value->>'product_id')::uuid AS product_id,
      (e.value->>'variant_id')::uuid AS variant_id,
      COALESCE(e.value->>'variant_title', 'Padrão') AS variant_title,
      COALESCE(e.value->'variant_attributes', '{}'::jsonb) AS variant_attributes,
      GREATEST(1, LEAST(99, COALESCE((e.value->>'quantity')::int, 1))) AS quantity,
      (e.value->>'price_jpy')::numeric AS price_jpy
    FROM jsonb_array_elements(v_intent.line_items) AS e(value)
  LOOP
    SELECT pv.stock_quantity, p.name INTO v_stock, v_name
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_line.variant_id
      AND p.id = v_line.product_id
      AND p.is_active = true
      AND pv.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variante não disponível';
    END IF;

    IF v_stock IS NOT NULL AND v_stock < v_line.quantity THEN
      RAISE EXCEPTION 'Variante de "%" sem estoque suficiente', v_name;
    END IF;
  END LOOP;

  INSERT INTO public.orders (
    user_id, created_by, order_source, ship_immediately, status, shipping_address_id,
    total_amount, total_amount_usd, shipping_cost, shipping_currency,
    coupon_id, discount_amount, checkout_intent_id
  ) VALUES (
    v_intent.user_id, v_intent.user_id, 'store', v_intent.ship_immediately, 'awaiting_payment',
    v_intent.shipping_address_id, v_intent.total_amount, v_intent.total_amount_usd,
    v_intent.shipping_cost_jpy,
    CASE WHEN v_intent.shipping_cost_jpy IS NOT NULL THEN COALESCE(NULLIF(trim(v_intent.shipping_currency), ''), 'JPY') ELSE NULL END,
    v_intent.coupon_id,
    CASE WHEN COALESCE(v_intent.discount_amount, 0) > 0 THEN v_intent.discount_amount ELSE NULL END,
    v_intent.id
  )
  RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT
      (e.value->>'product_id')::uuid AS product_id,
      (e.value->>'variant_id')::uuid AS variant_id,
      COALESCE(e.value->>'variant_title', 'Padrão') AS variant_title,
      COALESCE(e.value->'variant_attributes', '{}'::jsonb) AS variant_attributes,
      GREATEST(1, LEAST(99, COALESCE((e.value->>'quantity')::int, 1))) AS quantity,
      (e.value->>'price_jpy')::numeric AS price_jpy
    FROM jsonb_array_elements(v_intent.line_items) AS e(value)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_id, variant_id, variant_title, variant_attributes, quantity, price_at_purchase
    )
    VALUES (
      v_order_id, v_line.product_id, v_line.variant_id, v_line.variant_title, v_line.variant_attributes,
      v_line.quantity, ROUND(v_line.price_jpy::numeric, 2)
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;
