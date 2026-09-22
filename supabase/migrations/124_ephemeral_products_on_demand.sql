-- Produto efêmero on-demand:
-- - snapshot temporário (TTL) sem catálogo persistente
-- - carrinho efêmero separado
-- - checkout unificado via store_checkout_intents

CREATE TABLE IF NOT EXISTS public.ephemeral_products (
  token text PRIMARY KEY,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id text NOT NULL,
  external_url text NOT NULL,
  title text NOT NULL,
  snapshot_price_jpy numeric NOT NULL CHECK (snapshot_price_jpy >= 0),
  currency text NOT NULL DEFAULT 'JPY',
  image_url text NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NULL,
  current_price_jpy numeric NULL CHECK (current_price_jpy >= 0),
  current_title text NULL,
  current_image_url text NULL,
  is_available boolean NOT NULL DEFAULT true,
  validation_note text NULL
);

CREATE INDEX IF NOT EXISTS idx_ephemeral_products_expires_at ON public.ephemeral_products(expires_at);
CREATE INDEX IF NOT EXISTS idx_ephemeral_products_store_created ON public.ephemeral_products(store_id, created_at DESC);

ALTER TABLE public.ephemeral_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read valid ephemeral products" ON public.ephemeral_products;
CREATE POLICY "Public can read valid ephemeral products"
  ON public.ephemeral_products
  FOR SELECT
  USING (expires_at > now() AND is_available = true);

DROP POLICY IF EXISTS "Admins can manage ephemeral products" ON public.ephemeral_products;
CREATE POLICY "Admins can manage ephemeral products"
  ON public.ephemeral_products
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.cart_ephemeral_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ephemeral_token text NOT NULL REFERENCES public.ephemeral_products(token) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 99),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ephemeral_token)
);

CREATE INDEX IF NOT EXISTS idx_cart_ephemeral_items_user_id ON public.cart_ephemeral_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_ephemeral_items_token ON public.cart_ephemeral_items(ephemeral_token);

ALTER TABLE public.cart_ephemeral_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ephemeral cart" ON public.cart_ephemeral_items;
CREATE POLICY "Users can view own ephemeral cart"
  ON public.cart_ephemeral_items
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ephemeral cart" ON public.cart_ephemeral_items;
CREATE POLICY "Users can insert own ephemeral cart"
  ON public.cart_ephemeral_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ephemeral cart" ON public.cart_ephemeral_items;
CREATE POLICY "Users can update own ephemeral cart"
  ON public.cart_ephemeral_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ephemeral cart" ON public.cart_ephemeral_items;
CREATE POLICY "Users can delete own ephemeral cart"
  ON public.cart_ephemeral_items
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_cart_ephemeral_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cart_ephemeral_items_updated_at ON public.cart_ephemeral_items;
CREATE TRIGGER trg_cart_ephemeral_items_updated_at
BEFORE UPDATE ON public.cart_ephemeral_items
FOR EACH ROW
EXECUTE FUNCTION public.set_cart_ephemeral_items_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_expired_ephemeral_products()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  DELETE FROM public.ephemeral_products
  WHERE expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ephemeral_product(
  p_payload jsonb,
  p_ttl_minutes integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_store_id text;
  v_external_url text;
  v_title text;
  v_image_url text;
  v_currency text;
  v_price numeric;
  v_expires_at timestamptz;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  v_store_id := NULLIF(trim(COALESCE(p_payload->>'storeId', p_payload->>'store_id', '')), '');
  v_external_url := NULLIF(trim(COALESCE(p_payload->>'productUrl', p_payload->>'external_url', '')), '');
  v_title := NULLIF(trim(COALESCE(p_payload->>'title', '')), '');
  v_image_url := NULLIF(trim(COALESCE(p_payload->>'imageUrl', p_payload->>'image_url', '')), '');
  v_currency := COALESCE(NULLIF(trim(COALESCE(p_payload->>'currency', 'JPY')), ''), 'JPY');
  v_price := COALESCE((p_payload->>'price')::numeric, 0);

  IF v_store_id IS NULL OR v_external_url IS NULL OR v_title IS NULL THEN
    RAISE EXCEPTION 'Payload inválido para criar produto efêmero';
  END IF;
  IF v_price < 0 THEN
    RAISE EXCEPTION 'Preço inválido';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');
  v_expires_at := now() + make_interval(mins => GREATEST(10, LEAST(COALESCE(p_ttl_minutes, 120), 24 * 60)));

  INSERT INTO public.ephemeral_products (
    token, created_by, store_id, external_url, title, snapshot_price_jpy, currency, image_url, raw_payload, expires_at
  ) VALUES (
    v_token, v_uid, v_store_id, v_external_url, v_title, v_price, v_currency, v_image_url, COALESCE(p_payload, '{}'::jsonb), v_expires_at
  );

  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_ephemeral_product(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ephemeral_products%ROWTYPE;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.ephemeral_products
  WHERE token = trim(p_token)
    AND expires_at > now()
    AND is_available = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'token', v_row.token,
    'store_id', v_row.store_id,
    'external_url', v_row.external_url,
    'title', COALESCE(v_row.current_title, v_row.title),
    'price_jpy', COALESCE(v_row.current_price_jpy, v_row.snapshot_price_jpy),
    'currency', v_row.currency,
    'image_url', COALESCE(v_row.current_image_url, v_row.image_url),
    'expires_at', v_row.expires_at,
    'is_available', v_row.is_available
  );
END;
$$;

-- Revalidação leve para MVP:
-- mantém disponibilidade e atualiza "current_*" com snapshot.
CREATE OR REPLACE FUNCTION public.revalidate_ephemeral_product(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ephemeral_products%ROWTYPE;
BEGIN
  SELECT *
  INTO v_row
  FROM public.ephemeral_products
  WHERE token = trim(COALESCE(p_token, ''));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_row.expires_at <= now() THEN
    UPDATE public.ephemeral_products
    SET
      is_available = false,
      last_checked_at = now(),
      validation_note = 'expired'
    WHERE token = v_row.token;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  UPDATE public.ephemeral_products
  SET
    last_checked_at = now(),
    current_price_jpy = COALESCE(current_price_jpy, snapshot_price_jpy),
    current_title = COALESCE(current_title, title),
    current_image_url = COALESCE(current_image_url, image_url),
    is_available = true,
    validation_note = 'snapshot_revalidated'
  WHERE token = v_row.token
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_row.token,
    'current_price_jpy', COALESCE(v_row.current_price_jpy, v_row.snapshot_price_jpy),
    'current_title', COALESCE(v_row.current_title, v_row.title),
    'current_image_url', COALESCE(v_row.current_image_url, v_row.image_url),
    'is_available', v_row.is_available
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_ephemeral_to_cart(
  p_token text,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_row public.ephemeral_products%ROWTYPE;
  v_qty integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login para adicionar ao carrinho';
  END IF;

  SELECT *
  INTO v_row
  FROM public.ephemeral_products
  WHERE token = trim(COALESCE(p_token, ''));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto temporário não encontrado';
  END IF;
  IF v_row.expires_at <= now() THEN
    RAISE EXCEPTION 'Produto temporário expirado';
  END IF;
  IF v_row.is_available IS NOT TRUE THEN
    RAISE EXCEPTION 'Produto temporário indisponível';
  END IF;

  v_qty := GREATEST(1, LEAST(COALESCE(p_quantity, 1), 99));

  INSERT INTO public.cart_ephemeral_items (user_id, ephemeral_token, quantity)
  VALUES (v_uid, v_row.token, v_qty)
  ON CONFLICT (user_id, ephemeral_token)
  DO UPDATE SET quantity = LEAST(99, public.cart_ephemeral_items.quantity + EXCLUDED.quantity), updated_at = now();

  RETURN jsonb_build_object('ok', true, 'token', v_row.token);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_ephemeral_cart_items()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  ephemeral_token text,
  quantity integer,
  created_at timestamptz,
  updated_at timestamptz,
  store_id text,
  external_url text,
  title text,
  price_jpy numeric,
  currency text,
  image_url text,
  expires_at timestamptz,
  is_available boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.user_id,
    c.ephemeral_token,
    c.quantity,
    c.created_at,
    c.updated_at,
    e.store_id,
    e.external_url,
    COALESCE(e.current_title, e.title) AS title,
    COALESCE(e.current_price_jpy, e.snapshot_price_jpy) AS price_jpy,
    e.currency,
    COALESCE(e.current_image_url, e.image_url) AS image_url,
    e.expires_at,
    e.is_available
  FROM public.cart_ephemeral_items c
  JOIN public.ephemeral_products e ON e.token = c.ephemeral_token
  WHERE c.user_id = auth.uid()
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.update_ephemeral_cart_item(
  p_token text,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_qty integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login novamente';
  END IF;
  v_qty := GREATEST(1, LEAST(COALESCE(p_quantity, 1), 99));
  UPDATE public.cart_ephemeral_items
  SET quantity = v_qty, updated_at = now()
  WHERE user_id = v_uid AND ephemeral_token = trim(COALESCE(p_token, ''));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item temporário não encontrado no carrinho';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_ephemeral_from_cart(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login novamente';
  END IF;
  DELETE FROM public.cart_ephemeral_items
  WHERE user_id = v_uid AND ephemeral_token = trim(COALESCE(p_token, ''));
  RETURN jsonb_build_object('ok', true);
END;
$$;

ALTER TABLE public.order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'catalog';
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS ephemeral_token text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS source_store_id text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS source_product_url text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS snapshot_title text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS snapshot_image_url text;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS snapshot_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS validated_price numeric;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS validation_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_line_type_chk'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_line_type_chk
      CHECK (line_type IN ('catalog', 'ephemeral'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_line_type ON public.order_items(line_type);
CREATE INDEX IF NOT EXISTS idx_order_items_ephemeral_token ON public.order_items(ephemeral_token);

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
      'catalog'::text AS line_type,
      ci.quantity,
      p.id AS product_id,
      pv.id AS variant_id,
      p.purchase_group_id,
      p.name AS product_name,
      pv.title AS variant_title,
      pv.attributes,
      COALESCE(pv.price_jpy, p.price_jpy, p.price, 0) AS price_jpy,
      pv.stock_quantity,
      NULL::text AS ephemeral_token,
      NULL::text AS source_store_id,
      NULL::text AS source_product_url,
      NULL::text AS snapshot_title,
      NULL::text AS snapshot_image_url,
      '{}'::jsonb AS snapshot_payload
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    LEFT JOIN public.product_variants pv ON pv.id = ci.variant_id AND pv.product_id = p.id
    LEFT JOIN public.store_products sp ON sp.product_id = p.id AND sp.is_active = true
    WHERE ci.user_id = p_user_id
      AND (p.purchase_group_id IS NOT NULL OR sp.product_id IS NOT NULL)

    UNION ALL

    SELECT
      'ephemeral'::text AS line_type,
      ce.quantity,
      NULL::uuid AS product_id,
      NULL::uuid AS variant_id,
      NULL::uuid AS purchase_group_id,
      ep.title AS product_name,
      ep.title AS variant_title,
      jsonb_build_object('ephemeral_token', ep.token) AS attributes,
      COALESCE(ep.current_price_jpy, ep.snapshot_price_jpy, 0) AS price_jpy,
      NULL::integer AS stock_quantity,
      ep.token AS ephemeral_token,
      ep.store_id AS source_store_id,
      ep.external_url AS source_product_url,
      COALESCE(ep.current_title, ep.title) AS snapshot_title,
      COALESCE(ep.current_image_url, ep.image_url) AS snapshot_image_url,
      ep.raw_payload AS snapshot_payload
    FROM public.cart_ephemeral_items ce
    JOIN public.ephemeral_products ep ON ep.token = ce.ephemeral_token
    WHERE ce.user_id = p_user_id
      AND ep.expires_at > now()
      AND ep.is_available = true
  LOOP
    IF v_item.line_type = 'catalog' THEN
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
    END IF;

    IF COALESCE(v_item.price_jpy, 0) <= 0 THEN
      RAISE EXCEPTION 'Item com preço inválido no checkout';
    END IF;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'line_type', v_item.line_type,
      'product_id', v_item.product_id,
      'variant_id', v_item.variant_id,
      'variant_title', COALESCE(v_item.variant_title, 'Padrão'),
      'variant_attributes', COALESCE(v_item.attributes, '{}'::jsonb),
      'quantity', v_item.quantity,
      'price_jpy', ROUND(v_item.price_jpy::numeric, 2),
      'ephemeral_token', v_item.ephemeral_token,
      'source_store_id', v_item.source_store_id,
      'source_product_url', v_item.source_product_url,
      'snapshot_title', v_item.snapshot_title,
      'snapshot_image_url', v_item.snapshot_image_url,
      'snapshot_payload', COALESCE(v_item.snapshot_payload, '{}'::jsonb)
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
  v_reval jsonb;
  v_effective_price numeric;
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
      COALESCE(e.value->>'line_type', 'catalog') AS line_type,
      (e.value->>'product_id')::uuid AS product_id,
      (e.value->>'variant_id')::uuid AS variant_id,
      COALESCE(e.value->>'variant_title', 'Padrão') AS variant_title,
      COALESCE(e.value->'variant_attributes', '{}'::jsonb) AS variant_attributes,
      GREATEST(1, LEAST(99, COALESCE((e.value->>'quantity')::int, 1))) AS quantity,
      (e.value->>'price_jpy')::numeric AS price_jpy,
      NULLIF(trim(COALESCE(e.value->>'ephemeral_token', '')), '') AS ephemeral_token,
      NULLIF(trim(COALESCE(e.value->>'source_store_id', '')), '') AS source_store_id,
      NULLIF(trim(COALESCE(e.value->>'source_product_url', '')), '') AS source_product_url,
      NULLIF(trim(COALESCE(e.value->>'snapshot_title', '')), '') AS snapshot_title,
      NULLIF(trim(COALESCE(e.value->>'snapshot_image_url', '')), '') AS snapshot_image_url,
      COALESCE(e.value->'snapshot_payload', '{}'::jsonb) AS snapshot_payload
    FROM jsonb_array_elements(v_intent.line_items) AS e(value)
  LOOP
    IF v_line.line_type = 'catalog' THEN
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
    ELSE
      IF v_line.ephemeral_token IS NULL THEN
        RAISE EXCEPTION 'Linha efêmera inválida (token ausente)';
      END IF;

      v_reval := public.revalidate_ephemeral_product(v_line.ephemeral_token);
      IF COALESCE((v_reval->>'ok')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Item temporário indisponível ou expirado';
      END IF;
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
      COALESCE(e.value->>'line_type', 'catalog') AS line_type,
      (e.value->>'product_id')::uuid AS product_id,
      (e.value->>'variant_id')::uuid AS variant_id,
      COALESCE(e.value->>'variant_title', 'Padrão') AS variant_title,
      COALESCE(e.value->'variant_attributes', '{}'::jsonb) AS variant_attributes,
      GREATEST(1, LEAST(99, COALESCE((e.value->>'quantity')::int, 1))) AS quantity,
      (e.value->>'price_jpy')::numeric AS price_jpy,
      NULLIF(trim(COALESCE(e.value->>'ephemeral_token', '')), '') AS ephemeral_token,
      NULLIF(trim(COALESCE(e.value->>'source_store_id', '')), '') AS source_store_id,
      NULLIF(trim(COALESCE(e.value->>'source_product_url', '')), '') AS source_product_url,
      NULLIF(trim(COALESCE(e.value->>'snapshot_title', '')), '') AS snapshot_title,
      NULLIF(trim(COALESCE(e.value->>'snapshot_image_url', '')), '') AS snapshot_image_url,
      COALESCE(e.value->'snapshot_payload', '{}'::jsonb) AS snapshot_payload
    FROM jsonb_array_elements(v_intent.line_items) AS e(value)
  LOOP
    v_effective_price := ROUND(COALESCE(v_line.price_jpy, 0)::numeric, 2);

    IF v_line.line_type = 'ephemeral' THEN
      v_reval := public.revalidate_ephemeral_product(v_line.ephemeral_token);
      v_effective_price := ROUND(COALESCE((v_reval->>'current_price_jpy')::numeric, v_effective_price)::numeric, 2);
      IF v_effective_price <= 0 THEN
        RAISE EXCEPTION 'Item temporário com preço inválido na revalidação';
      END IF;
    END IF;

    INSERT INTO public.order_items (
      order_id,
      line_type,
      product_id,
      variant_id,
      variant_title,
      variant_attributes,
      quantity,
      price_at_purchase,
      ephemeral_token,
      source_store_id,
      source_product_url,
      snapshot_title,
      snapshot_image_url,
      snapshot_payload,
      validated_price,
      validation_status
    )
    VALUES (
      v_order_id,
      v_line.line_type,
      CASE WHEN v_line.line_type = 'catalog' THEN v_line.product_id ELSE NULL END,
      CASE WHEN v_line.line_type = 'catalog' THEN v_line.variant_id ELSE NULL END,
      v_line.variant_title,
      v_line.variant_attributes,
      v_line.quantity,
      v_effective_price,
      CASE WHEN v_line.line_type = 'ephemeral' THEN v_line.ephemeral_token ELSE NULL END,
      CASE WHEN v_line.line_type = 'ephemeral' THEN v_line.source_store_id ELSE NULL END,
      CASE WHEN v_line.line_type = 'ephemeral' THEN v_line.source_product_url ELSE NULL END,
      CASE WHEN v_line.line_type = 'ephemeral' THEN v_line.snapshot_title ELSE NULL END,
      CASE WHEN v_line.line_type = 'ephemeral' THEN v_line.snapshot_image_url ELSE NULL END,
      CASE WHEN v_line.line_type = 'ephemeral' THEN v_line.snapshot_payload ELSE '{}'::jsonb END,
      CASE WHEN v_line.line_type = 'ephemeral' THEN v_effective_price ELSE NULL END,
      CASE
        WHEN v_line.line_type = 'ephemeral' AND v_effective_price <> ROUND(COALESCE(v_line.price_jpy, 0)::numeric, 2)
          THEN 'price_updated'
        WHEN v_line.line_type = 'ephemeral'
          THEN 'price_same'
        ELSE NULL
      END
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_ephemeral_cart_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.order_source <> 'store' THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'awaiting_payment' OR NOT (NEW.status IN ('paid', 'products_paid')) THEN
    RETURN NEW;
  END IF;

  FOR v_item IN
    SELECT oi.ephemeral_token, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.line_type = 'ephemeral'
      AND oi.ephemeral_token IS NOT NULL
  LOOP
    UPDATE public.cart_ephemeral_items
    SET quantity = GREATEST(quantity - v_item.quantity, 0), updated_at = now()
    WHERE user_id = NEW.user_id
      AND ephemeral_token = v_item.ephemeral_token;

    DELETE FROM public.cart_ephemeral_items
    WHERE user_id = NEW.user_id
      AND ephemeral_token = v_item.ephemeral_token
      AND quantity <= 0;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_ephemeral_cart_on_order_paid ON public.orders;
CREATE TRIGGER trg_decrement_ephemeral_cart_on_order_paid
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.decrement_ephemeral_cart_on_order_paid();

GRANT EXECUTE ON FUNCTION public.cleanup_expired_ephemeral_products() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_ephemeral_product(jsonb, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_ephemeral_product(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revalidate_ephemeral_product(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.add_ephemeral_to_cart(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_ephemeral_cart_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ephemeral_cart_item(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_ephemeral_from_cart(text) TO authenticated;
