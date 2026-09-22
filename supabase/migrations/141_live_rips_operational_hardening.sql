-- Live Rips operational hardening
-- Covers: wallet idempotency, admin CRUD/listing, stock controls,
-- realtime publication, and post-live inventory integration.

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

  -- Serializa tentativas concorrentes na mesma reserva (double click / multi-tab).
  PERFORM pg_advisory_xact_lock(hashtext('live_rip_pay_' || p_reservation_id::text));

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
    AND r.payment_status <> 'paid'
  RETURNING * INTO v_reservation;

  IF v_reservation.id IS NULL THEN
    SELECT *
      INTO v_reservation
    FROM public.live_rip_reservations r
    WHERE r.id = p_reservation_id;
    RETURN jsonb_build_object(
      'already_paid', true,
      'reservation', to_jsonb(v_reservation)
    );
  END IF;

  RETURN jsonb_build_object(
    'already_paid', false,
    'wallet_transaction', v_tx,
    'reservation', to_jsonb(v_reservation)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_list_events(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
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
      e.*,
      (
        SELECT COUNT(*)
        FROM public.live_rip_reservations r
        WHERE r.event_id = e.id
      )::integer AS reservations_count
    FROM public.live_events e
    ORDER BY COALESCE(e.starts_at, now() + interval '100 years') ASC, e.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_list_products(
  p_category_id text DEFAULT NULL,
  p_active_only boolean DEFAULT false,
  p_limit integer DEFAULT 300,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 300), 1), 1000);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT p.*
    FROM public.live_rip_products p
    WHERE (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (NOT p_active_only OR p.is_active = true)
    ORDER BY p.category_id, COALESCE(p.popularity_rank, 999999), p.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_adjust_stock(
  p_product_id text,
  p_delta integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.live_rip_products%ROWTYPE;
  v_before integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_product_id IS NULL OR length(trim(p_product_id)) = 0 THEN
    RAISE EXCEPTION 'Produto inválido';
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Delta inválido';
  END IF;

  SELECT *
    INTO v_row
  FROM public.live_rip_products p
  WHERE p.id = trim(p_product_id)
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  v_before := COALESCE(v_row.available_rips, 0);

  UPDATE public.live_rip_products
  SET available_rips = GREATEST(0, COALESCE(available_rips, 0) + p_delta)
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  PERFORM public.admin_insert_log(
    'live_rips_stock_adjust',
    'live_rip_product',
    NULL,
    jsonb_build_object(
      'product_id', v_row.id,
      'before', v_before,
      'after', v_row.available_rips,
      'delta', p_delta,
      'reason', COALESCE(p_reason, '')
    )
  );

  RETURN to_jsonb(v_row);
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
  v_prev text;
  v_next text := COALESCE(NULLIF(trim(COALESCE(p_status, '')), ''), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT *
    INTO v_row
  FROM public.live_rip_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Reserva não encontrada';
  END IF;

  v_prev := COALESCE(v_row.status, '');

  IF v_next = '' THEN
    v_next := v_prev;
  END IF;

  IF v_prev = 'cancelled' AND v_next <> 'cancelled' THEN
    RAISE EXCEPTION 'Reserva cancelada não pode voltar no fluxo';
  END IF;

  IF v_next NOT IN ('reserved', 'paid', 'separated', 'waiting_live', 'opening', 'cards_logged', 'cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  IF v_prev <> v_next THEN
    IF NOT (
      (v_prev = 'reserved' AND v_next IN ('paid', 'cancelled')) OR
      (v_prev = 'paid' AND v_next IN ('separated', 'cancelled')) OR
      (v_prev = 'separated' AND v_next IN ('waiting_live', 'cancelled')) OR
      (v_prev = 'waiting_live' AND v_next IN ('opening', 'cancelled')) OR
      (v_prev = 'opening' AND v_next IN ('cards_logged', 'cancelled')) OR
      (v_prev = 'cards_logged' AND v_next = 'cards_logged')
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida (% -> %)', v_prev, v_next;
    END IF;
  END IF;

  UPDATE public.live_rip_reservations
  SET
    status = v_next,
    payment_status = CASE WHEN v_next IN ('paid', 'separated', 'waiting_live', 'opening', 'cards_logged') THEN 'paid' ELSE payment_status END,
    rip_code = COALESCE(
      NULLIF(trim(COALESCE(p_rip_code, '')), ''),
      rip_code,
      ('RIP-' || UPPER(LEFT(id::text, 8)))
    )
  WHERE id = p_reservation_id
  RETURNING * INTO v_row;

  PERFORM public.admin_insert_log(
    'live_rips_reservation_status',
    'live_rip_reservation',
    v_row.id,
    jsonb_build_object('before', v_prev, 'after', v_row.status, 'rip_code', COALESCE(v_row.rip_code, ''))
  );

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

  PERFORM public.admin_insert_log(
    'live_rips_pull_add',
    'live_rip_reservation',
    v_row.reservation_id,
    jsonb_build_object('pull_id', v_row.id, 'card_name', v_row.card_name, 'rarity', COALESCE(v_row.rarity, ''))
  );

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_finalize_to_inventory(
  p_reservation_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reservation public.live_rip_reservations%ROWTYPE;
  v_product public.live_rip_products%ROWTYPE;
  v_inventory_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT *
    INTO v_reservation
  FROM public.live_rip_reservations r
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION 'Reserva não encontrada';
  END IF;

  IF v_reservation.status <> 'cards_logged' THEN
    RAISE EXCEPTION 'A reserva precisa estar em cards_logged para finalizar';
  END IF;

  SELECT *
    INTO v_product
  FROM public.live_rip_products p
  WHERE p.id = v_reservation.product_id;

  INSERT INTO public.user_inventory (
    user_id,
    name,
    notes,
    status
  )
  VALUES (
    v_reservation.user_id,
    COALESCE(v_product.name_en, v_product.name, v_reservation.product_id),
    COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Origem: Live Rip ' || COALESCE(v_reservation.rip_code, LEFT(v_reservation.id::text, 8))),
    'stored'
  )
  RETURNING id INTO v_inventory_id;

  PERFORM public.admin_insert_log(
    'live_rips_finalize_inventory',
    'live_rip_reservation',
    v_reservation.id,
    jsonb_build_object('inventory_id', v_inventory_id, 'user_id', v_reservation.user_id)
  );

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'inventory_id', v_inventory_id,
    'status', 'stored'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_my_pulls(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para visualizar seus pulls.';
  END IF;

  IF v_event_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.card_name,
      p.rarity,
      p.market_value_jpy,
      p.image_url,
      p.pulled_at
    FROM public.live_rip_pulls p
    JOIN public.live_rip_reservations r ON r.id = p.reservation_id
    WHERE r.user_id = v_user_id
      AND r.event_id = v_event_id
    ORDER BY p.pulled_at DESC, p.created_at DESC
  ) t;

  RETURN v_rows;
END;
$$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_events';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rip_products';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rip_reservations';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rip_pulls';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_live_rips_list_events(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_list_products(text, boolean, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_adjust_stock(text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_finalize_to_inventory(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_my_pulls(uuid) TO authenticated, service_role;
