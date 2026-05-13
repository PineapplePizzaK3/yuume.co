-- Migrate referred-user benefit from coupon to wallet credit.
-- Credit is granted when admin approves referral (idempotent per referral_id).

CREATE OR REPLACE FUNCTION public.grant_referral_indicated_wallet_credit(
  p_referral_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_credit_brl NUMERIC;
  v_fx_brl_per_jpy NUMERIC;
  v_credit_jpy NUMERIC;
  v_existing_tx_id UUID;
  v_credit_result JSONB;
BEGIN
  IF p_referral_id IS NULL THEN
    RAISE EXCEPTION 'Referral inválido';
  END IF;

  SELECT *
  INTO v_ref
  FROM public.referrals
  WHERE id = p_referral_id
  LIMIT 1;

  IF v_ref.id IS NULL THEN
    RAISE EXCEPTION 'Referral não encontrado';
  END IF;

  -- Idempotency guard: one wallet credit per referral approval.
  SELECT wt.id
  INTO v_existing_tx_id
  FROM public.wallet_transactions wt
  WHERE wt.user_id = v_ref.referred_id
    AND wt.kind = 'credit'
    AND wt.type = 'referral_indicated_credit'
    AND wt.reference_type = 'referral'
    AND wt.reference_id = v_ref.id
  ORDER BY wt.created_at DESC
  LIMIT 1;

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_granted', true,
      'transaction_id', v_existing_tx_id,
      'referred_id', v_ref.referred_id
    );
  END IF;

  -- Keep amount aligned with the old referred coupon value (stored in BRL settings).
  v_credit_brl := GREATEST(0, public.get_setting_number('referral_discount_value', 0));
  IF v_credit_brl <= 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_granted', false,
      'skipped', true,
      'reason', 'referral_discount_value_disabled'
    );
  END IF;

  -- Wallet is JPY-based: convert BRL setting to JPY with configured FX.
  v_fx_brl_per_jpy := GREATEST(0, public.get_setting_number('fx_brl_per_jpy', 0));
  IF v_fx_brl_per_jpy > 0 THEN
    v_credit_jpy := ROUND(v_credit_brl / v_fx_brl_per_jpy);
  ELSE
    -- Fallback for environments without FX setting.
    v_credit_jpy := ROUND(v_credit_brl);
  END IF;
  v_credit_jpy := GREATEST(1, COALESCE(v_credit_jpy, 0));

  v_credit_result := public.wallet_credit(
    v_ref.referred_id,
    v_credit_jpy,
    'referral_indicated_credit',
    'Crédito de indicação (indicado) - uso na plataforma',
    'referral',
    v_ref.id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_granted', false,
    'referred_id', v_ref.referred_id,
    'referral_id', v_ref.id,
    'credited_jpy', v_credit_jpy,
    'wallet_credit', v_credit_result
  );
END;
$$;

COMMENT ON FUNCTION public.grant_referral_indicated_wallet_credit(uuid) IS
  'Credita o indicado na carteira (JPY) após aprovação admin da referral. Idempotente por referral_id.';

-- Disable automatic referred coupon issuance from referral status changes.
DROP TRIGGER IF EXISTS trg_issue_referral_coupon_after_insert ON public.referrals;
DROP TRIGGER IF EXISTS trg_issue_referral_coupon_after_update ON public.referrals;
