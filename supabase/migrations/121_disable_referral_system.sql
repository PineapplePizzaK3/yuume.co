-- Temporarily disable referral flows end-to-end.
-- Safe to run multiple times.

-- Stop automatic referral binding on new profile creation.
DROP TRIGGER IF EXISTS trg_bind_referral_from_profile_insert ON public.profiles;

-- Stop automatic referral qualification/reward pipeline on order updates.
DROP TRIGGER IF EXISTS trg_qualify_referral_on_paid ON public.orders;

-- Ensure referred coupon issuance triggers stay disabled.
DROP TRIGGER IF EXISTS trg_issue_referral_coupon_after_insert ON public.referrals;
DROP TRIGGER IF EXISTS trg_issue_referral_coupon_after_update ON public.referrals;

-- Convert referral functions into no-op responses while feature is disabled.
CREATE OR REPLACE FUNCTION public.bind_referral_on_signup(
  p_referred_user_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', false,
    'disabled', true,
    'reason', 'referral_disabled'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.qualify_referral_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_due_referral_rewards(p_limit INT DEFAULT 500)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_referral_indicated_wallet_credit(
  p_referral_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'ok', false,
    'disabled', true,
    'reason', 'referral_disabled'
  );
END;
$$;

COMMENT ON FUNCTION public.bind_referral_on_signup(uuid, text)
  IS 'Referral temporarily disabled.';
COMMENT ON FUNCTION public.release_due_referral_rewards(int)
  IS 'Referral temporarily disabled.';
COMMENT ON FUNCTION public.grant_referral_indicated_wallet_credit(uuid)
  IS 'Referral temporarily disabled.';

