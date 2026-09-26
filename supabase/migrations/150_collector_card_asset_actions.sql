-- Collector card asset post-open actions:
-- - Instant sell-back at 80% of recorded pull market value
-- - PSA grading request lifecycle

ALTER TABLE public.collector_card_assets
  DROP CONSTRAINT IF EXISTS collector_card_assets_status_check;

ALTER TABLE public.collector_card_assets
  ADD CONSTRAINT collector_card_assets_status_check
  CHECK (status IN ('held', 'sold', 'grading', 'graded'));

ALTER TABLE public.collector_card_assets
  ADD COLUMN IF NOT EXISTS buyback_amount_jpy numeric(14,2) CHECK (buyback_amount_jpy IS NULL OR buyback_amount_jpy >= 0),
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS grading_provider text DEFAULT 'PSA',
  ADD COLUMN IF NOT EXISTS grading_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS grading_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS psa_cert_number text,
  ADD COLUMN IF NOT EXISTS psa_grade text,
  ADD COLUMN IF NOT EXISTS action_note text;

CREATE INDEX IF NOT EXISTS idx_collector_card_assets_status_owner
  ON public.collector_card_assets(status, owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.service_collector_sell_back_asset(p_asset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_asset public.collector_card_assets%ROWTYPE;
  v_pull public.opening_pulls%ROWTYPE;
  v_offer_jpy numeric(14,2) := 0;
  v_tx jsonb := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para vender a carta.';
  END IF;
  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'Card asset inválido.';
  END IF;

  SELECT *
    INTO v_asset
  FROM public.collector_card_assets
  WHERE id = p_asset_id
  FOR UPDATE;

  IF v_asset.id IS NULL THEN
    RAISE EXCEPTION 'Card asset não encontrado.';
  END IF;
  IF v_asset.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Você não possui permissão para vender este card asset.';
  END IF;

  IF v_asset.status = 'sold' THEN
    RETURN jsonb_build_object(
      'asset', to_jsonb(v_asset),
      'credited_jpy', COALESCE(v_asset.buyback_amount_jpy, 0),
      'wallet_transaction', NULL
    );
  END IF;
  IF v_asset.status <> 'held' THEN
    RAISE EXCEPTION 'Apenas cards em coleção podem ser vendidos.';
  END IF;

  SELECT *
    INTO v_pull
  FROM public.opening_pulls
  WHERE id = v_asset.pull_id;

  IF v_pull.id IS NULL THEN
    RAISE EXCEPTION 'Pull de origem não encontrado.';
  END IF;
  IF COALESCE(v_pull.market_value_jpy, 0) <= 0 THEN
    RAISE EXCEPTION 'Este card não possui valor de mercado para sell-back.';
  END IF;

  v_offer_jpy := FLOOR(COALESCE(v_pull.market_value_jpy, 0) * 0.8);
  IF v_offer_jpy <= 0 THEN
    RAISE EXCEPTION 'Oferta de sell-back inválida.';
  END IF;

  v_tx := public.wallet_credit(
    v_user_id,
    v_offer_jpy,
    'collector_buyback',
    'Sell-back 80% do card asset ' || left(v_asset.id::text, 8),
    'collector_card_asset',
    v_asset.id
  );

  UPDATE public.collector_card_assets
  SET
    status = 'sold',
    buyback_amount_jpy = v_offer_jpy,
    sold_at = now(),
    action_note = COALESCE(action_note, 'Sell-back 80% executado.'),
    updated_at = now()
  WHERE id = v_asset.id
  RETURNING *
    INTO v_asset;

  RETURN jsonb_build_object(
    'asset', to_jsonb(v_asset),
    'credited_jpy', v_offer_jpy,
    'wallet_transaction', v_tx
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.service_collector_request_psa_grading(p_asset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_asset public.collector_card_assets%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para solicitar grading.';
  END IF;
  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'Card asset inválido.';
  END IF;

  SELECT *
    INTO v_asset
  FROM public.collector_card_assets
  WHERE id = p_asset_id
  FOR UPDATE;

  IF v_asset.id IS NULL THEN
    RAISE EXCEPTION 'Card asset não encontrado.';
  END IF;
  IF v_asset.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'Você não possui permissão para este card asset.';
  END IF;

  IF v_asset.status = 'grading' OR v_asset.status = 'graded' THEN
    RETURN to_jsonb(v_asset);
  END IF;
  IF v_asset.status <> 'held' THEN
    RAISE EXCEPTION 'Apenas cards em coleção podem ir para grading.';
  END IF;

  UPDATE public.collector_card_assets
  SET
    status = 'grading',
    grading_provider = 'PSA',
    grading_requested_at = now(),
    grading_completed_at = NULL,
    psa_cert_number = NULL,
    psa_grade = NULL,
    action_note = 'Solicitação de grading PSA enviada.',
    updated_at = now()
  WHERE id = v_asset.id
  RETURNING *
    INTO v_asset;

  RETURN to_jsonb(v_asset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_list_grading_queue(
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
      cca.id,
      cca.owner_id,
      cca.status,
      cca.condition,
      cca.grading_provider,
      cca.grading_requested_at,
      cca.buyback_amount_jpy,
      op.id AS pull_id,
      op.card_name,
      op.rarity,
      op.image_url,
      op.market_value_jpy,
      pa.id AS allocation_id,
      pa.batch_id,
      ob.code AS batch_code,
      ob.product_id,
      lrp.name AS product_name,
      pr.email AS owner_email,
      pr.name AS owner_name,
      cca.created_at,
      cca.updated_at
    FROM public.collector_card_assets cca
    LEFT JOIN public.opening_pulls op ON op.id = cca.pull_id
    LEFT JOIN public.pack_allocations pa ON pa.id = op.allocation_id
    LEFT JOIN public.opening_batches ob ON ob.id = pa.batch_id
    LEFT JOIN public.live_rip_products lrp ON lrp.id = ob.product_id
    LEFT JOIN public.profiles pr ON pr.id = cca.owner_id
    WHERE cca.status = 'grading'
    ORDER BY cca.grading_requested_at DESC NULLS LAST, cca.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_complete_psa_grading(
  p_asset_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asset public.collector_card_assets%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'Card asset inválido.';
  END IF;

  SELECT *
    INTO v_asset
  FROM public.collector_card_assets
  WHERE id = p_asset_id
  FOR UPDATE;

  IF v_asset.id IS NULL THEN
    RAISE EXCEPTION 'Card asset não encontrado.';
  END IF;
  IF v_asset.status = 'graded' THEN
    RETURN to_jsonb(v_asset);
  END IF;
  IF v_asset.status <> 'grading' THEN
    RAISE EXCEPTION 'Apenas cards em grading podem ser concluídos.';
  END IF;

  UPDATE public.collector_card_assets
  SET
    status = 'graded',
    grading_completed_at = now(),
    psa_cert_number = NULLIF(trim(COALESCE(p_payload->>'psa_cert_number', '')), ''),
    psa_grade = NULLIF(trim(COALESCE(p_payload->>'psa_grade', '')), ''),
    action_note = COALESCE(
      NULLIF(trim(COALESCE(p_payload->>'action_note', '')), ''),
      'Grading PSA concluído.'
    ),
    updated_at = now()
  WHERE id = p_asset_id
  RETURNING *
    INTO v_asset;

  RETURN to_jsonb(v_asset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_collector_cancel_psa_grading(
  p_asset_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asset public.collector_card_assets%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'Card asset inválido.';
  END IF;

  SELECT *
    INTO v_asset
  FROM public.collector_card_assets
  WHERE id = p_asset_id
  FOR UPDATE;

  IF v_asset.id IS NULL THEN
    RAISE EXCEPTION 'Card asset não encontrado.';
  END IF;
  IF v_asset.status = 'held' THEN
    RETURN to_jsonb(v_asset);
  END IF;
  IF v_asset.status <> 'grading' THEN
    RAISE EXCEPTION 'Apenas cards em grading podem ser cancelados.';
  END IF;

  UPDATE public.collector_card_assets
  SET
    status = 'held',
    grading_provider = COALESCE(grading_provider, 'PSA'),
    grading_requested_at = NULL,
    grading_completed_at = NULL,
    psa_cert_number = NULL,
    psa_grade = NULL,
    action_note = COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), 'Solicitação de grading PSA cancelada.'),
    updated_at = now()
  WHERE id = p_asset_id
  RETURNING *
    INTO v_asset;

  RETURN to_jsonb(v_asset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.service_collector_sell_back_asset(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_collector_request_psa_grading(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_list_grading_queue(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_complete_psa_grading(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_collector_cancel_psa_grading(uuid, text) TO service_role;
