-- Live Rips core domain (events, products, reservations, pulls)
-- Fase 1 + base para fases 2/3/4 do roadmap.

CREATE TABLE IF NOT EXISTS public.live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  starts_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'live', 'completed')),
  stream_url text,
  cover_image_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_events_slug_not_blank CHECK (length(trim(slug)) > 0),
  CONSTRAINT live_events_title_not_blank CHECK (length(trim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS public.live_rip_products (
  id text PRIMARY KEY,
  category_id text NOT NULL,
  category_label_pt text,
  category_label_en text,
  name text NOT NULL,
  name_en text,
  type text,
  language text DEFAULT 'Japanese',
  image_url text,
  source text,
  collection_title text,
  shrinkwrap_option text CHECK (shrinkwrap_option IN ('with', 'without') OR shrinkwrap_option IS NULL),
  snkrdunk_apparel_id text,
  popularity_rank integer,
  price_jpy numeric(14,2) NOT NULL DEFAULT 0 CHECK (price_jpy >= 0),
  price_label text,
  available_rips integer NOT NULL DEFAULT 0 CHECK (available_rips >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_rip_products_id_not_blank CHECK (length(trim(id)) > 0),
  CONSTRAINT live_rip_products_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.live_rip_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.live_rip_products(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rip_code text UNIQUE,
  queue_position integer,
  status text NOT NULL DEFAULT 'reserved' CHECK (
    status IN ('reserved', 'paid', 'separated', 'waiting_live', 'opening', 'cards_logged', 'cancelled')
  ),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_provider text,
  payment_reference text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  price_jpy numeric(14,2) NOT NULL DEFAULT 0 CHECK (price_jpy >= 0),
  price_currency text NOT NULL DEFAULT 'JPY',
  customer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_rip_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.live_rip_reservations(id) ON DELETE CASCADE,
  card_name text NOT NULL,
  rarity text,
  market_value_jpy numeric(14,2),
  image_url text,
  pulled_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_rip_pulls_card_name_not_blank CHECK (length(trim(card_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_live_events_status_starts_at ON public.live_events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_live_rip_products_category_active_rank ON public.live_rip_products(category_id, is_active, popularity_rank);
CREATE INDEX IF NOT EXISTS idx_live_rip_products_active ON public.live_rip_products(is_active);
CREATE INDEX IF NOT EXISTS idx_live_rip_reservations_user_event ON public.live_rip_reservations(user_id, event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_rip_reservations_event_status ON public.live_rip_reservations(event_id, status, queue_position);
CREATE INDEX IF NOT EXISTS idx_live_rip_pulls_event_reservation ON public.live_rip_pulls(event_id, reservation_id, pulled_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_live_rip_one_active_reservation_per_user_event
ON public.live_rip_reservations(event_id, user_id)
WHERE status IN ('reserved', 'paid', 'separated', 'waiting_live', 'opening', 'cards_logged');

CREATE OR REPLACE FUNCTION public.live_rips_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_events_touch_updated_at ON public.live_events;
CREATE TRIGGER trg_live_events_touch_updated_at
BEFORE UPDATE ON public.live_events
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS trg_live_rip_products_touch_updated_at ON public.live_rip_products;
CREATE TRIGGER trg_live_rip_products_touch_updated_at
BEFORE UPDATE ON public.live_rip_products
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS trg_live_rip_reservations_touch_updated_at ON public.live_rip_reservations;
CREATE TRIGGER trg_live_rip_reservations_touch_updated_at
BEFORE UPDATE ON public.live_rip_reservations
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS trg_live_rip_pulls_touch_updated_at ON public.live_rip_pulls;
CREATE TRIGGER trg_live_rip_pulls_touch_updated_at
BEFORE UPDATE ON public.live_rip_pulls
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_rip_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_rip_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_rip_pulls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_events_public_read" ON public.live_events;
CREATE POLICY "live_events_public_read"
  ON public.live_events
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "live_rip_products_public_read" ON public.live_rip_products;
CREATE POLICY "live_rip_products_public_read"
  ON public.live_rip_products
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "live_rip_reservations_owner_read" ON public.live_rip_reservations;
CREATE POLICY "live_rip_reservations_owner_read"
  ON public.live_rip_reservations
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "live_rip_reservations_admin_manage" ON public.live_rip_reservations;
CREATE POLICY "live_rip_reservations_admin_manage"
  ON public.live_rip_reservations
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "live_rip_pulls_public_read" ON public.live_rip_pulls;
CREATE POLICY "live_rip_pulls_public_read"
  ON public.live_rip_pulls
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "live_rip_pulls_admin_manage" ON public.live_rip_pulls;
CREATE POLICY "live_rip_pulls_admin_manage"
  ON public.live_rip_pulls
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "live_events_admin_manage" ON public.live_events;
CREATE POLICY "live_events_admin_manage"
  ON public.live_events
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "live_rip_products_admin_manage" ON public.live_rip_products;
CREATE POLICY "live_rip_products_admin_manage"
  ON public.live_rip_products
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_active_live_event_id()
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  SELECT le.id
    INTO v_event_id
  FROM public.live_events le
  WHERE le.status IN ('live', 'scheduled')
  ORDER BY
    CASE WHEN le.status = 'live' THEN 0 ELSE 1 END,
    COALESCE(le.starts_at, now() + interval '100 years') ASC,
    le.created_at DESC
  LIMIT 1;
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_reserve(
  p_product_id text,
  p_event_id uuid DEFAULT NULL,
  p_customer_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_existing public.live_rip_reservations%ROWTYPE;
  v_product public.live_rip_products%ROWTYPE;
  v_next_queue integer;
  v_reservation public.live_rip_reservations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para reservar um Rip.';
  END IF;

  IF p_product_id IS NULL OR length(trim(p_product_id)) = 0 THEN
    RAISE EXCEPTION 'Produto inválido para reserva.';
  END IF;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma live ativa/agendada para reserva.';
  END IF;

  SELECT *
    INTO v_existing
  FROM public.live_rip_reservations r
  WHERE r.event_id = v_event_id
    AND r.user_id = v_user_id
    AND r.status IN ('reserved', 'paid', 'separated', 'waiting_live', 'opening', 'cards_logged')
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_reserved', true,
      'reservation', to_jsonb(v_existing)
    );
  END IF;

  SELECT *
    INTO v_product
  FROM public.live_rip_products p
  WHERE p.id = trim(p_product_id)
    AND p.is_active = true
  FOR UPDATE;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado para reserva.';
  END IF;

  IF COALESCE(v_product.available_rips, 0) <= 0 THEN
    RAISE EXCEPTION 'Este produto está sem disponibilidade no momento.';
  END IF;

  SELECT COALESCE(MAX(r.queue_position), 0) + 1
    INTO v_next_queue
  FROM public.live_rip_reservations r
  WHERE r.event_id = v_event_id;

  INSERT INTO public.live_rip_reservations (
    event_id,
    product_id,
    user_id,
    queue_position,
    status,
    payment_status,
    price_jpy,
    price_currency,
    customer_note
  )
  VALUES (
    v_event_id,
    v_product.id,
    v_user_id,
    v_next_queue,
    'reserved',
    'pending',
    COALESCE(v_product.price_jpy, 0),
    'JPY',
    NULLIF(trim(COALESCE(p_customer_note, '')), '')
  )
  RETURNING *
  INTO v_reservation;

  UPDATE public.live_rip_products
  SET available_rips = GREATEST(0, available_rips - 1)
  WHERE id = v_product.id;

  RETURN jsonb_build_object(
    'already_reserved', false,
    'reservation', to_jsonb(v_reservation)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_my_reservation(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_row jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para visualizar sua Rip.';
  END IF;

  IF v_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(x)
    INTO v_row
  FROM (
    SELECT
      r.*,
      p.name AS product_name,
      p.name_en AS product_name_en,
      p.image_url AS product_image,
      p.category_id,
      p.price_label,
      e.title AS event_title,
      e.starts_at AS event_starts_at,
      e.status AS event_status
    FROM public.live_rip_reservations r
    JOIN public.live_rip_products p ON p.id = r.product_id
    JOIN public.live_events e ON e.id = r.event_id
    WHERE r.user_id = v_user_id
      AND r.event_id = v_event_id
      AND r.status <> 'cancelled'
    ORDER BY r.created_at DESC
    LIMIT 1
  ) x;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_public_queue(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_event jsonb;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('event', NULL, 'rows', '[]'::jsonb);
  END IF;

  SELECT to_jsonb(e)
    INTO v_event
  FROM (
    SELECT id, slug, title, starts_at, status, stream_url, cover_image_url
    FROM public.live_events
    WHERE id = v_event_id
  ) e;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      r.id,
      r.rip_code,
      r.queue_position,
      r.status,
      COALESCE(pr.name, p.name) AS customer_name,
      p.id AS product_id,
      p.name AS product_name,
      p.name_en AS product_name_en,
      p.image_url AS product_image
    FROM public.live_rip_reservations r
    JOIN public.live_rip_products p ON p.id = r.product_id
    LEFT JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.event_id = v_event_id
      AND r.status IN ('reserved', 'paid', 'separated', 'waiting_live', 'opening', 'cards_logged')
    ORDER BY COALESCE(r.queue_position, 999999), r.created_at
  ) t;

  RETURN jsonb_build_object('event', v_event, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_public_pulls(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_event_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.reservation_id,
      p.card_name,
      p.rarity,
      p.market_value_jpy,
      p.image_url,
      p.pulled_at
    FROM public.live_rip_pulls p
    WHERE p.event_id = v_event_id
    ORDER BY p.pulled_at DESC, p.created_at DESC
    LIMIT 100
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_mark_paid(
  p_reservation_id uuid,
  p_payment_provider text,
  p_payment_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.live_rip_reservations%ROWTYPE;
BEGIN
  IF p_reservation_id IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida para pagamento.';
  END IF;

  UPDATE public.live_rip_reservations r
  SET
    payment_status = 'paid',
    payment_provider = NULLIF(trim(COALESCE(p_payment_provider, '')), ''),
    payment_reference = NULLIF(trim(COALESCE(p_payment_reference, '')), ''),
    status = CASE WHEN r.status = 'reserved' THEN 'paid' ELSE r.status END
  WHERE r.id = p_reservation_id
  RETURNING *
  INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Reserva não encontrada para confirmação de pagamento.';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_upsert_event(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := NULLIF(trim(COALESCE(p_payload->>'id', '')), '')::uuid;
  v_row public.live_events%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.live_events (
      slug, title, starts_at, status, stream_url, cover_image_url, notes, created_by
    ) VALUES (
      NULLIF(trim(COALESCE(p_payload->>'slug', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'title', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'starts_at', '')), '')::timestamptz,
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'status', '')), ''), 'scheduled'),
      NULLIF(trim(COALESCE(p_payload->>'stream_url', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'cover_image_url', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'notes', '')), ''),
      auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.live_events
    SET
      slug = COALESCE(NULLIF(trim(COALESCE(p_payload->>'slug', '')), ''), slug),
      title = COALESCE(NULLIF(trim(COALESCE(p_payload->>'title', '')), ''), title),
      starts_at = COALESCE(NULLIF(trim(COALESCE(p_payload->>'starts_at', '')), '')::timestamptz, starts_at),
      status = COALESCE(NULLIF(trim(COALESCE(p_payload->>'status', '')), ''), status),
      stream_url = COALESCE(NULLIF(trim(COALESCE(p_payload->>'stream_url', '')), ''), stream_url),
      cover_image_url = COALESCE(NULLIF(trim(COALESCE(p_payload->>'cover_image_url', '')), ''), cover_image_url),
      notes = COALESCE(NULLIF(trim(COALESCE(p_payload->>'notes', '')), ''), notes)
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_upsert_product(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id text := NULLIF(trim(COALESCE(p_payload->>'id', '')), '');
  v_row public.live_rip_products%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'id do produto é obrigatório';
  END IF;

  INSERT INTO public.live_rip_products (
    id, category_id, category_label_pt, category_label_en, name, name_en, type, language,
    image_url, source, collection_title, shrinkwrap_option, snkrdunk_apparel_id, popularity_rank,
    price_jpy, price_label, available_rips, is_active, created_by
  ) VALUES (
    v_id,
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'category_id', '')), ''), 'uncategorized'),
    NULLIF(trim(COALESCE(p_payload->>'category_label_pt', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'category_label_en', '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'name', '')), ''), v_id),
    NULLIF(trim(COALESCE(p_payload->>'name_en', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'type', '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'language', '')), ''), 'Japanese'),
    NULLIF(trim(COALESCE(p_payload->>'image_url', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'source', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'collection_title', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'shrinkwrap_option', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'snkrdunk_apparel_id', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'popularity_rank', '')), '')::integer,
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'price_jpy', '')), '')::numeric, 0),
    NULLIF(trim(COALESCE(p_payload->>'price_label', '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'available_rips', '')), '')::integer, 0),
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'is_active', '')), '')::boolean, true),
    auth.uid()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    category_id = EXCLUDED.category_id,
    category_label_pt = EXCLUDED.category_label_pt,
    category_label_en = EXCLUDED.category_label_en,
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    type = EXCLUDED.type,
    language = EXCLUDED.language,
    image_url = EXCLUDED.image_url,
    source = EXCLUDED.source,
    collection_title = EXCLUDED.collection_title,
    shrinkwrap_option = EXCLUDED.shrinkwrap_option,
    snkrdunk_apparel_id = EXCLUDED.snkrdunk_apparel_id,
    popularity_rank = EXCLUDED.popularity_rank,
    price_jpy = EXCLUDED.price_jpy,
    price_label = EXCLUDED.price_label,
    available_rips = EXCLUDED.available_rips,
    is_active = EXCLUDED.is_active
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_list_reservations(
  p_event_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total bigint := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('rows', '[]'::jsonb, 'total', 0);
  END IF;

  SELECT COUNT(*)
    INTO v_total
  FROM public.live_rip_reservations r
  WHERE r.event_id = v_event_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      r.*,
      p.name AS product_name,
      p.name_en AS product_name_en,
      p.image_url AS product_image,
      COALESCE(pr.name, '') AS customer_name,
      COALESCE(pr.email, '') AS customer_email
    FROM public.live_rip_reservations r
    JOIN public.live_rip_products p ON p.id = r.product_id
    LEFT JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.event_id = v_event_id
    ORDER BY COALESCE(r.queue_position, 999999), r.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_set_reservation_status(
  p_reservation_id uuid,
  p_status text,
  p_rip_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.live_rip_reservations%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.live_rip_reservations
  SET
    status = COALESCE(NULLIF(trim(COALESCE(p_status, '')), ''), status),
    rip_code = COALESCE(NULLIF(trim(COALESCE(p_rip_code, '')), ''), rip_code)
  WHERE id = p_reservation_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_add_pull(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.live_rip_pulls%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.live_rip_pulls (
    event_id,
    reservation_id,
    card_name,
    rarity,
    market_value_jpy,
    image_url,
    pulled_at,
    created_by
  ) VALUES (
    NULLIF(trim(COALESCE(p_payload->>'event_id', '')), '')::uuid,
    NULLIF(trim(COALESCE(p_payload->>'reservation_id', '')), '')::uuid,
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'card_name', '')), ''), 'Card'),
    NULLIF(trim(COALESCE(p_payload->>'rarity', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'market_value_jpy', '')), '')::numeric,
    NULLIF(trim(COALESCE(p_payload->>'image_url', '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'pulled_at', '')), '')::timestamptz, now()),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_pay_with_wallet(
  p_reservation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reservation public.live_rip_reservations%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_charge_jpy numeric;
  v_tx jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para pagar com créditos.';
  END IF;

  IF p_reservation_id IS NULL THEN
    RAISE EXCEPTION 'Reserva inválida.';
  END IF;

  SELECT *
    INTO v_reservation
  FROM public.live_rip_reservations r
  WHERE r.id = p_reservation_id
    AND r.user_id = v_user_id
  FOR UPDATE;

  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION 'Reserva não encontrada.';
  END IF;

  IF v_reservation.status = 'cancelled' THEN
    RAISE EXCEPTION 'Reserva cancelada.';
  END IF;

  IF v_reservation.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'already_paid', true,
      'reservation', to_jsonb(v_reservation)
    );
  END IF;

  v_charge_jpy := COALESCE(v_reservation.price_jpy, 0);
  IF v_charge_jpy <= 0 THEN
    RAISE EXCEPTION 'Preço inválido da reserva.';
  END IF;

  SELECT *
    INTO v_wallet
  FROM public.wallets w
  WHERE w.user_id = v_user_id
  FOR UPDATE;

  IF v_wallet.user_id IS NULL THEN
    RAISE EXCEPTION 'Você não possui créditos suficientes. Adicione saldo na carteira.';
  END IF;

  IF COALESCE(UPPER(TRIM(v_wallet.currency)), 'JPY') <> 'JPY' THEN
    RAISE EXCEPTION 'Moeda da carteira inválida para Live Rips.';
  END IF;

  IF COALESCE(v_wallet.balance, 0) < v_charge_jpy THEN
    RAISE EXCEPTION 'Saldo insuficiente na carteira para concluir este Rip.';
  END IF;

  v_tx := public.wallet_debit(
    v_user_id,
    v_charge_jpy,
    'live_rip',
    'Live Rip - Reserva ' || LEFT(v_reservation.id::text, 8),
    'live_rip_reservation',
    v_reservation.id
  );

  UPDATE public.live_rip_reservations r
  SET
    payment_status = 'paid',
    payment_provider = 'wallet',
    payment_reference = COALESCE(v_tx->>'transaction_id', r.payment_reference),
    status = CASE WHEN r.status = 'reserved' THEN 'paid' ELSE r.status END
  WHERE r.id = v_reservation.id
  RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'already_paid', false,
    'wallet_transaction', v_tx,
    'reservation', to_jsonb(v_reservation)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_live_event_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_reserve(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_my_reservation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_public_queue(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_public_pulls(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_pay_with_wallet(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_mark_paid(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_upsert_event(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_upsert_product(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_list_reservations(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_set_reservation_status(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_add_pull(jsonb) TO authenticated, service_role;

INSERT INTO public.live_events (slug, title, starts_at, status)
SELECT 'japan-rip-night-01', 'JAPAN RIP NIGHT #01', now() + interval '3 days', 'scheduled'
WHERE NOT EXISTS (
  SELECT 1 FROM public.live_events WHERE slug = 'japan-rip-night-01'
);
