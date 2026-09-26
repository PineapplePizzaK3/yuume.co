-- Collector opening batches (batch-first domain)
-- Schema + RLS + indexes + updated_at triggers.

CREATE TABLE IF NOT EXISTS public.opening_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  product_id text NOT NULL REFERENCES public.live_rip_products(id) ON DELETE RESTRICT,
  game text,
  physical_box_code text,
  total_positions integer NOT NULL CHECK (total_positions > 0),
  price_per_position_jpy numeric(14,2) NOT NULL DEFAULT 0 CHECK (price_per_position_jpy >= 0),
  status text NOT NULL DEFAULT 'OPEN' CHECK (
    status IN ('OPEN', 'FULL', 'LOCKED', 'SCHEDULED', 'OPENING', 'COMPLETED', 'FULFILLING', 'CANCELLED')
  ),
  opens_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opening_batches_code_not_blank CHECK (length(trim(code)) > 0)
);

CREATE TABLE IF NOT EXISTS public.pack_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.opening_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled')),
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opening_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.opening_batches(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'RECORDING', 'PUBLISHED', 'CANCELLED')),
  video_url text,
  recorded_at timestamptz,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opening_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.opening_sessions(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES public.pack_allocations(id) ON DELETE SET NULL,
  card_name text NOT NULL,
  rarity text,
  image_url text,
  market_value_jpy numeric(14,2) CHECK (market_value_jpy IS NULL OR market_value_jpy >= 0),
  is_highlight boolean NOT NULL DEFAULT false,
  pulled_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opening_pulls_card_name_not_blank CHECK (length(trim(card_name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.collector_card_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_id uuid NOT NULL UNIQUE REFERENCES public.opening_pulls(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held')),
  condition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opening_batches_status_opens_at
  ON public.opening_batches(status, opens_at);

CREATE INDEX IF NOT EXISTS idx_opening_batches_product
  ON public.opening_batches(product_id);

CREATE INDEX IF NOT EXISTS idx_pack_allocations_batch_status
  ON public.pack_allocations(batch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pack_allocations_user_created
  ON public.pack_allocations(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pack_allocations_active_user_per_batch
  ON public.pack_allocations(batch_id, user_id)
  WHERE status IN ('reserved', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_opening_sessions_batch_status
  ON public.opening_sessions(batch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opening_pulls_session_pulled
  ON public.opening_pulls(session_id, pulled_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_opening_pulls_allocation
  ON public.opening_pulls(allocation_id);

CREATE INDEX IF NOT EXISTS idx_collector_card_assets_owner_created
  ON public.collector_card_assets(owner_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_opening_batches_touch_updated_at ON public.opening_batches;
CREATE TRIGGER trg_opening_batches_touch_updated_at
BEFORE UPDATE ON public.opening_batches
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pack_allocations_touch_updated_at ON public.pack_allocations;
CREATE TRIGGER trg_pack_allocations_touch_updated_at
BEFORE UPDATE ON public.pack_allocations
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS trg_opening_sessions_touch_updated_at ON public.opening_sessions;
CREATE TRIGGER trg_opening_sessions_touch_updated_at
BEFORE UPDATE ON public.opening_sessions
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS trg_opening_pulls_touch_updated_at ON public.opening_pulls;
CREATE TRIGGER trg_opening_pulls_touch_updated_at
BEFORE UPDATE ON public.opening_pulls
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS trg_collector_card_assets_touch_updated_at ON public.collector_card_assets;
CREATE TRIGGER trg_collector_card_assets_touch_updated_at
BEFORE UPDATE ON public.collector_card_assets
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.opening_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_pulls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_card_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opening_batches_public_read" ON public.opening_batches;
CREATE POLICY "opening_batches_public_read"
  ON public.opening_batches
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "opening_batches_admin_manage" ON public.opening_batches;
CREATE POLICY "opening_batches_admin_manage"
  ON public.opening_batches
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "pack_allocations_owner_read" ON public.pack_allocations;
CREATE POLICY "pack_allocations_owner_read"
  ON public.pack_allocations
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "pack_allocations_admin_manage" ON public.pack_allocations;
CREATE POLICY "pack_allocations_admin_manage"
  ON public.pack_allocations
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "opening_sessions_visible" ON public.opening_sessions;
CREATE POLICY "opening_sessions_visible"
  ON public.opening_sessions
  FOR SELECT
  USING (
    status = 'PUBLISHED'
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.pack_allocations pa
      WHERE pa.batch_id = opening_sessions.batch_id
        AND pa.user_id = auth.uid()
        AND pa.status IN ('reserved', 'confirmed')
    )
  );

DROP POLICY IF EXISTS "opening_sessions_admin_manage" ON public.opening_sessions;
CREATE POLICY "opening_sessions_admin_manage"
  ON public.opening_sessions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "opening_pulls_visible" ON public.opening_pulls;
CREATE POLICY "opening_pulls_visible"
  ON public.opening_pulls
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.opening_sessions os
      WHERE os.id = opening_pulls.session_id
        AND os.status = 'PUBLISHED'
    )
    OR EXISTS (
      SELECT 1
      FROM public.pack_allocations pa
      WHERE pa.id = opening_pulls.allocation_id
        AND pa.user_id = auth.uid()
        AND pa.status IN ('reserved', 'confirmed')
    )
  );

DROP POLICY IF EXISTS "opening_pulls_admin_manage" ON public.opening_pulls;
CREATE POLICY "opening_pulls_admin_manage"
  ON public.opening_pulls
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "collector_card_assets_owner_read" ON public.collector_card_assets;
CREATE POLICY "collector_card_assets_owner_read"
  ON public.collector_card_assets
  FOR SELECT
  USING (auth.uid() = owner_id OR public.is_admin());

DROP POLICY IF EXISTS "collector_card_assets_admin_manage" ON public.collector_card_assets;
CREATE POLICY "collector_card_assets_admin_manage"
  ON public.collector_card_assets
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.service_collector_list_batches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rows jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      b.id,
      b.code,
      b.product_id,
      b.game,
      b.physical_box_code,
      b.total_positions,
      b.price_per_position_jpy,
      b.status,
      b.opens_at,
      b.notes,
      b.created_at,
      b.updated_at,
      p.name AS product_name,
      p.name_en AS product_name_en,
      p.image_url AS product_image_url,
      p.category_id AS product_category_id,
      COALESCE(stats.reserved_positions, 0) AS reserved_positions,
      GREATEST(b.total_positions - COALESCE(stats.reserved_positions, 0), 0) AS available_positions,
      ua.id AS my_allocation_id,
      COALESCE(ua.quantity, 0) AS my_reserved_quantity,
      (ua.id IS NOT NULL) AS is_joined
    FROM public.opening_batches b
    JOIN public.live_rip_products p ON p.id = b.product_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(pa.quantity), 0) AS reserved_positions
      FROM public.pack_allocations pa
      WHERE pa.batch_id = b.id
        AND pa.status IN ('reserved', 'confirmed')
    ) stats ON true
    LEFT JOIN LATERAL (
      SELECT pa.id, pa.quantity
      FROM public.pack_allocations pa
      WHERE pa.batch_id = b.id
        AND pa.user_id = v_user_id
        AND pa.status IN ('reserved', 'confirmed')
      ORDER BY pa.created_at DESC
      LIMIT 1
    ) ua ON true
    WHERE b.status <> 'CANCELLED'
    ORDER BY b.created_at DESC
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_collector_reserve_position(
  p_batch_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_batch public.opening_batches%ROWTYPE;
  v_allocation public.pack_allocations%ROWTYPE;
  v_reserved integer := 0;
  v_available integer := 0;
  v_qty integer := GREATEST(COALESCE(p_quantity, 1), 1);
  v_next_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para reservar posição.';
  END IF;
  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Abertura inválida.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('collector_opening_batch_' || p_batch_id::text));

  SELECT *
    INTO v_batch
  FROM public.opening_batches b
  WHERE b.id = p_batch_id
  FOR UPDATE;

  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'Abertura não encontrada.';
  END IF;

  IF v_batch.status NOT IN ('OPEN', 'FULL') THEN
    RAISE EXCEPTION 'Abertura indisponível para novas reservas.';
  END IF;

  SELECT COALESCE(SUM(pa.quantity), 0)::integer
    INTO v_reserved
  FROM public.pack_allocations pa
  WHERE pa.batch_id = v_batch.id
    AND pa.status IN ('reserved', 'confirmed');

  v_available := GREATEST(v_batch.total_positions - v_reserved, 0);
  IF v_available < v_qty THEN
    RAISE EXCEPTION 'Não há posições suficientes disponíveis.';
  END IF;

  SELECT *
    INTO v_allocation
  FROM public.pack_allocations pa
  WHERE pa.batch_id = v_batch.id
    AND pa.user_id = v_user_id
    AND pa.status IN ('reserved', 'confirmed')
  ORDER BY pa.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_allocation.id IS NULL THEN
    INSERT INTO public.pack_allocations (
      batch_id,
      user_id,
      quantity,
      status,
      code
    ) VALUES (
      v_batch.id,
      v_user_id,
      v_qty,
      'reserved',
      'ALC-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8))
    )
    RETURNING *
    INTO v_allocation;
  ELSE
    UPDATE public.pack_allocations
    SET quantity = quantity + v_qty
    WHERE id = v_allocation.id
    RETURNING *
    INTO v_allocation;
  END IF;

  v_reserved := v_reserved + v_qty;
  v_next_status := CASE WHEN v_reserved >= v_batch.total_positions THEN 'FULL' ELSE 'OPEN' END;

  UPDATE public.opening_batches
  SET status = v_next_status
  WHERE id = v_batch.id
  RETURNING *
  INTO v_batch;

  RETURN jsonb_build_object(
    'batch_id', v_batch.id,
    'allocation_id', v_allocation.id,
    'quantity', v_allocation.quantity,
    'reserved_positions', v_reserved,
    'available_positions', GREATEST(v_batch.total_positions - v_reserved, 0),
    'status', v_batch.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_upsert_batch(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := NULLIF(trim(COALESCE(p_payload->>'id', '')), '')::uuid;
  v_row public.opening_batches%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.opening_batches (
      code,
      product_id,
      game,
      physical_box_code,
      total_positions,
      price_per_position_jpy,
      status,
      opens_at,
      notes,
      created_by
    ) VALUES (
      NULLIF(trim(COALESCE(p_payload->>'code', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'product_id', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'game', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'physical_box_code', '')), ''),
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'total_positions', '')), '')::integer, 1),
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'price_per_position_jpy', '')), '')::numeric, 0),
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'status', '')), ''), 'OPEN'),
      NULLIF(trim(COALESCE(p_payload->>'opens_at', '')), '')::timestamptz,
      NULLIF(trim(COALESCE(p_payload->>'notes', '')), ''),
      auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.opening_batches
    SET
      code = COALESCE(NULLIF(trim(COALESCE(p_payload->>'code', '')), ''), code),
      product_id = COALESCE(NULLIF(trim(COALESCE(p_payload->>'product_id', '')), ''), product_id),
      game = COALESCE(NULLIF(trim(COALESCE(p_payload->>'game', '')), ''), game),
      physical_box_code = COALESCE(NULLIF(trim(COALESCE(p_payload->>'physical_box_code', '')), ''), physical_box_code),
      total_positions = COALESCE(NULLIF(trim(COALESCE(p_payload->>'total_positions', '')), '')::integer, total_positions),
      price_per_position_jpy = COALESCE(NULLIF(trim(COALESCE(p_payload->>'price_per_position_jpy', '')), '')::numeric, price_per_position_jpy),
      status = COALESCE(NULLIF(trim(COALESCE(p_payload->>'status', '')), ''), status),
      opens_at = COALESCE(NULLIF(trim(COALESCE(p_payload->>'opens_at', '')), '')::timestamptz, opens_at),
      notes = COALESCE(NULLIF(trim(COALESCE(p_payload->>'notes', '')), ''), notes)
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_set_batch_status(
  p_batch_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.opening_batches%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.opening_batches
  SET status = COALESCE(NULLIF(trim(COALESCE(p_status, '')), ''), status)
  WHERE id = p_batch_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_list_batches(
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      b.*,
      p.name AS product_name,
      p.name_en AS product_name_en,
      p.image_url AS product_image_url,
      COALESCE(stats.reserved_positions, 0) AS reserved_positions,
      GREATEST(b.total_positions - COALESCE(stats.reserved_positions, 0), 0) AS available_positions
    FROM public.opening_batches b
    JOIN public.live_rip_products p ON p.id = b.product_id
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(pa.quantity), 0) AS reserved_positions
      FROM public.pack_allocations pa
      WHERE pa.batch_id = b.id
        AND pa.status IN ('reserved', 'confirmed')
    ) stats ON true
    ORDER BY b.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_list_allocations(
  p_batch_id uuid,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total bigint := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*)
    INTO v_total
  FROM public.pack_allocations pa
  WHERE pa.batch_id = p_batch_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      pa.*,
      COALESCE(pr.name, '') AS customer_name,
      COALESCE(pr.email, '') AS customer_email
    FROM public.pack_allocations pa
    LEFT JOIN public.profiles pr ON pr.id = pa.user_id
    WHERE pa.batch_id = p_batch_id
    ORDER BY pa.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_upsert_session(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := NULLIF(trim(COALESCE(p_payload->>'id', '')), '')::uuid;
  v_row public.opening_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.opening_sessions (
      batch_id,
      status,
      video_url,
      recorded_at,
      published_at,
      created_by
    ) VALUES (
      NULLIF(trim(COALESCE(p_payload->>'batch_id', '')), '')::uuid,
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'status', '')), ''), 'SCHEDULED'),
      NULLIF(trim(COALESCE(p_payload->>'video_url', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'recorded_at', '')), '')::timestamptz,
      NULLIF(trim(COALESCE(p_payload->>'published_at', '')), '')::timestamptz,
      auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.opening_sessions
    SET
      batch_id = COALESCE(NULLIF(trim(COALESCE(p_payload->>'batch_id', '')), '')::uuid, batch_id),
      status = COALESCE(NULLIF(trim(COALESCE(p_payload->>'status', '')), ''), status),
      video_url = COALESCE(NULLIF(trim(COALESCE(p_payload->>'video_url', '')), ''), video_url),
      recorded_at = COALESCE(NULLIF(trim(COALESCE(p_payload->>'recorded_at', '')), '')::timestamptz, recorded_at),
      published_at = COALESCE(NULLIF(trim(COALESCE(p_payload->>'published_at', '')), '')::timestamptz, published_at)
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_list_sessions(
  p_batch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT os.*
    FROM public.opening_sessions os
    WHERE p_batch_id IS NULL OR os.batch_id = p_batch_id
    ORDER BY os.created_at DESC
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_add_pull(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.opening_pulls%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.opening_pulls (
    session_id,
    allocation_id,
    card_name,
    rarity,
    image_url,
    market_value_jpy,
    is_highlight,
    pulled_at,
    created_by
  ) VALUES (
    NULLIF(trim(COALESCE(p_payload->>'session_id', '')), '')::uuid,
    NULLIF(trim(COALESCE(p_payload->>'allocation_id', '')), '')::uuid,
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'card_name', '')), ''), 'Card'),
    NULLIF(trim(COALESCE(p_payload->>'rarity', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'image_url', '')), ''),
    NULLIF(trim(COALESCE(p_payload->>'market_value_jpy', '')), '')::numeric,
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'is_highlight', '')), '')::boolean, false),
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'pulled_at', '')), '')::timestamptz, now()),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_list_pulls(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT op.*
    FROM public.opening_pulls op
    WHERE op.session_id = p_session_id
    ORDER BY op.pulled_at DESC, op.created_at DESC
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_delete_pull(p_pull_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.opening_pulls
  WHERE id = p_pull_id
  RETURNING id INTO v_deleted;

  RETURN jsonb_build_object('deleted_id', v_deleted);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_publish_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.opening_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.opening_sessions
  SET
    status = 'PUBLISHED',
    published_at = COALESCE(published_at, now())
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada.';
  END IF;

  INSERT INTO public.collector_card_assets (pull_id, owner_id, status, condition)
  SELECT
    op.id AS pull_id,
    pa.user_id AS owner_id,
    'held',
    'raw'
  FROM public.opening_pulls op
  JOIN public.pack_allocations pa ON pa.id = op.allocation_id
  WHERE op.session_id = v_session.id
    AND pa.status IN ('reserved', 'confirmed')
  ON CONFLICT (pull_id) DO NOTHING;

  UPDATE public.opening_batches
  SET status = 'COMPLETED'
  WHERE id = v_session.batch_id;

  RETURN to_jsonb(v_session);
END;
$$;

GRANT EXECUTE ON FUNCTION public.service_collector_list_batches() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_collector_reserve_position(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_upsert_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_set_batch_status(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_list_batches(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_list_allocations(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_upsert_session(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_list_sessions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_add_pull(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_list_pulls(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_delete_pull(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_publish_session(uuid) TO service_role;
