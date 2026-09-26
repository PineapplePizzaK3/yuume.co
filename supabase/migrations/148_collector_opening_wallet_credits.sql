-- Collector openings: charge positions with wallet credits (JPY) only.
-- Users buy credits via existing wallet top-up; openings never call card/PIX gateways directly.

ALTER TABLE public.pack_allocations
  ADD COLUMN IF NOT EXISTS price_jpy numeric(14,2) NOT NULL DEFAULT 0 CHECK (price_jpy >= 0),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

COMMENT ON COLUMN public.pack_allocations.price_jpy IS
  'Total credits (JPY) charged for this allocation; openings settle only via wallet credits.';
COMMENT ON COLUMN public.pack_allocations.payment_status IS
  'pending until wallet debit succeeds; paid = credits charged.';

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
      COALESCE(ua.price_jpy, 0) AS my_price_jpy,
      COALESCE(ua.payment_status, 'pending') AS my_payment_status,
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
      SELECT pa.id, pa.quantity, pa.price_jpy, pa.payment_status
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
  v_wallet public.wallets%ROWTYPE;
  v_reserved integer := 0;
  v_available integer := 0;
  v_qty integer := GREATEST(COALESCE(p_quantity, 1), 1);
  v_unit_price numeric(14,2) := 0;
  v_charge_jpy numeric(14,2) := 0;
  v_next_status text;
  v_tx jsonb;
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

  v_unit_price := COALESCE(v_batch.price_per_position_jpy, 0);
  IF v_unit_price < 0 THEN
    RAISE EXCEPTION 'Preço inválido da abertura.';
  END IF;

  v_charge_jpy := ROUND(v_unit_price * v_qty, 2);

  SELECT COALESCE(SUM(pa.quantity), 0)::integer
    INTO v_reserved
  FROM public.pack_allocations pa
  WHERE pa.batch_id = v_batch.id
    AND pa.status IN ('reserved', 'confirmed');

  v_available := GREATEST(v_batch.total_positions - v_reserved, 0);
  IF v_available < v_qty THEN
    RAISE EXCEPTION 'Não há posições suficientes disponíveis.';
  END IF;

  -- Charge wallet credits (JPY) before confirming seats. Free (0) openings skip debit.
  IF v_charge_jpy > 0 THEN
    SELECT *
      INTO v_wallet
    FROM public.wallets w
    WHERE w.user_id = v_user_id
    FOR UPDATE;

    IF v_wallet.user_id IS NULL THEN
      RAISE EXCEPTION 'Você não possui créditos suficientes. Adicione saldo na carteira.';
    END IF;

    IF COALESCE(UPPER(TRIM(v_wallet.currency)), 'JPY') <> 'JPY' THEN
      RAISE EXCEPTION 'Moeda da carteira inválida para aberturas.';
    END IF;

    IF COALESCE(v_wallet.balance, 0) < v_charge_jpy THEN
      RAISE EXCEPTION 'Saldo insuficiente na carteira. Adicione créditos para reservar posições.';
    END IF;
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
      code,
      price_jpy,
      payment_status,
      payment_provider
    ) VALUES (
      v_batch.id,
      v_user_id,
      v_qty,
      'confirmed',
      'ALC-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8)),
      v_charge_jpy,
      CASE WHEN v_charge_jpy > 0 THEN 'pending' ELSE 'paid' END,
      CASE WHEN v_charge_jpy > 0 THEN NULL ELSE 'wallet' END
    )
    RETURNING *
    INTO v_allocation;
  ELSE
    UPDATE public.pack_allocations
    SET
      quantity = quantity + v_qty,
      status = 'confirmed',
      price_jpy = COALESCE(price_jpy, 0) + v_charge_jpy
    WHERE id = v_allocation.id
    RETURNING *
    INTO v_allocation;
  END IF;

  IF v_charge_jpy > 0 THEN
    v_tx := public.wallet_debit(
      v_user_id,
      v_charge_jpy,
      'collector_opening',
      'Abertura ' || COALESCE(v_batch.code, LEFT(v_batch.id::text, 8)) || ' ×' || v_qty::text,
      'pack_allocation',
      v_allocation.id
    );

    UPDATE public.pack_allocations
    SET
      payment_status = 'paid',
      payment_provider = 'wallet',
      payment_reference = COALESCE(v_tx->>'transaction_id', payment_reference),
      status = 'confirmed'
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
    'charged_jpy', v_charge_jpy,
    'price_jpy', v_allocation.price_jpy,
    'payment_status', v_allocation.payment_status,
    'reserved_positions', v_reserved,
    'available_positions', GREATEST(v_batch.total_positions - v_reserved, 0),
    'status', v_batch.status,
    'wallet_transaction', v_tx
  );
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

  -- Only paid/confirmed seats receive card assets.
  INSERT INTO public.collector_card_assets (pull_id, owner_id, status, condition)
  SELECT
    op.id AS pull_id,
    pa.user_id AS owner_id,
    'held',
    'raw'
  FROM public.opening_pulls op
  JOIN public.pack_allocations pa ON pa.id = op.allocation_id
  WHERE op.session_id = v_session.id
    AND pa.status = 'confirmed'
    AND pa.payment_status = 'paid'
  ON CONFLICT (pull_id) DO NOTHING;

  UPDATE public.opening_batches
  SET status = 'COMPLETED'
  WHERE id = v_session.batch_id;

  RETURN to_jsonb(v_session);
END;
$$;

COMMENT ON FUNCTION public.service_collector_reserve_position(uuid, integer) IS
  'Reserva posições de abertura debitando créditos da carteira (JPY). Sem gateway direto.';
