-- Align instant sell-back with the advertised offer: up to 85% of market value.

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

  v_offer_jpy := FLOOR(COALESCE(v_pull.market_value_jpy, 0) * 0.85);
  IF v_offer_jpy <= 0 THEN
    RAISE EXCEPTION 'Oferta de sell-back inválida.';
  END IF;

  v_tx := public.wallet_credit(
    v_user_id,
    v_offer_jpy,
    'collector_buyback',
    'Sell-back 85% do card asset ' || left(v_asset.id::text, 8),
    'collector_card_asset',
    v_asset.id
  );

  UPDATE public.collector_card_assets
  SET
    status = 'sold',
    buyback_amount_jpy = v_offer_jpy,
    sold_at = now(),
    action_note = COALESCE(action_note, 'Sell-back 85% executado.'),
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

GRANT EXECUTE ON FUNCTION public.service_collector_sell_back_asset(uuid) TO authenticated, service_role;
