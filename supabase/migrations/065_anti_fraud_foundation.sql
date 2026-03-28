-- Anti-fraud foundation for referral + affiliate systems.
-- Adds risk metadata, delayed reward release, and manual review support.

-- =============================
-- Config keys (all configurable via system_settings)
-- =============================
INSERT INTO public.system_settings (key, value)
VALUES
  ('fraud_same_ip_score', jsonb_build_object('amount', 30)),
  ('fraud_same_fingerprint_score', jsonb_build_object('amount', 40)),
  ('fraud_fast_purchase_score', jsonb_build_object('amount', 20)),
  ('fraud_no_browsing_score', jsonb_build_object('amount', 10)),
  ('fraud_geo_mismatch_score', jsonb_build_object('amount', 15)),
  ('fraud_proxy_score', jsonb_build_object('amount', 20)),
  ('fraud_threshold_approve_max', jsonb_build_object('amount', 30)),
  ('fraud_threshold_review_max', jsonb_build_object('amount', 60)),
  ('fraud_max_accounts_per_ip_window', jsonb_build_object('amount', 3)),
  ('fraud_ip_window_minutes', jsonb_build_object('amount', 30)),
  ('fraud_referral_max_per_month', jsonb_build_object('amount', 30)),
  ('fraud_referral_max_reward_amount', jsonb_build_object('amount', 1000)),
  ('fraud_affiliate_max_conversions_per_day', jsonb_build_object('amount', 50)),
  ('fraud_affiliate_max_commission_before_review', jsonb_build_object('amount', 3000)),
  ('fraud_reward_hold_days', jsonb_build_object('amount', 7)),
  ('fraud_min_order_threshold', jsonb_build_object('amount', 5)),
  ('fraud_min_order_repeats', jsonb_build_object('amount', 3))
ON CONFLICT (key) DO NOTHING;

-- =============================
-- User/device observability
-- =============================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_last_login_ip ON public.profiles(last_login_ip);
CREATE INDEX IF NOT EXISTS idx_profiles_device_fingerprint ON public.profiles(device_fingerprint);

-- =============================
-- Fraud logs
-- =============================
CREATE TABLE IF NOT EXISTS public.fraud_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  risk_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fraud_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read fraud logs" ON public.fraud_logs;
CREATE POLICY "Admins can read fraud logs" ON public.fraud_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "System can insert fraud logs" ON public.fraud_logs;
CREATE POLICY "System can insert fraud logs" ON public.fraud_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fraud_logs_created ON public.fraud_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_user ON public.fraud_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_action ON public.fraud_logs(action_type, created_at DESC);

-- =============================
-- Referral risk + manual review metadata
-- =============================
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'flagged', 'qualified', 'rewarded', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_referrals_status_risk ON public.referrals(status, risk_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_release_at ON public.referrals(reward_release_at) WHERE reward_given = false;

-- =============================
-- Affiliate risk + manual review metadata
-- =============================
ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flags JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_ip_created ON public.affiliate_clicks(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_fp_created ON public.affiliate_clicks(device_fingerprint, created_at DESC);

ALTER TABLE public.affiliate_orders
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.affiliate_orders DROP CONSTRAINT IF EXISTS affiliate_orders_status_check;
ALTER TABLE public.affiliate_orders
  ADD CONSTRAINT affiliate_orders_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'flagged', 'paid', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_affiliate_orders_status_risk ON public.affiliate_orders(status, risk_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_release_at ON public.affiliate_orders(reward_release_at) WHERE status IN ('pending', 'approved');

-- =============================
-- Fingerprint helper
-- =============================
CREATE OR REPLACE FUNCTION public.generate_device_fingerprint(
  p_ip TEXT,
  p_user_agent TEXT,
  p_device_type TEXT,
  p_os TEXT,
  p_timezone TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    digest(
      lower(
        coalesce(trim(p_ip), '') || '|' ||
        coalesce(trim(p_user_agent), '') || '|' ||
        coalesce(trim(p_device_type), '') || '|' ||
        coalesce(trim(p_os), '') || '|' ||
        coalesce(trim(p_timezone), '')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- =============================
-- Reward delay: referral
-- =============================
CREATE OR REPLACE FUNCTION public.qualify_referral_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_hold_days INT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.acquisition_mode <> 'referral' OR NEW.referral_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Reward pipeline starts only after delivery step.
  IF NEW.status NOT IN ('shipped', 'completed', 'delivered') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ref
  FROM public.referrals
  WHERE id = NEW.referral_id
  LIMIT 1;

  IF v_ref.id IS NULL OR v_ref.reward_given THEN
    RETURN NEW;
  END IF;

  v_hold_days := GREATEST(0, COALESCE(public.get_setting_number('fraud_reward_hold_days', 7), 7)::INT);

  UPDATE public.referrals
  SET
    status = CASE WHEN status = 'flagged' THEN 'flagged' ELSE 'approved' END,
    qualified_order_id = NEW.id,
    qualified_at = NOW(),
    reward_release_at = NOW() + make_interval(days => v_hold_days),
    updated_at = NOW()
  WHERE id = v_ref.id
    AND reward_given = false;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_due_referral_rewards(p_limit INT DEFAULT 500)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_credit NUMERIC;
  v_count INT := 0;
BEGIN
  v_credit := GREATEST(0, public.get_setting_number('referral_credit_value', 0));
  IF v_credit <= 0 THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id, referrer_id, referred_id, qualified_order_id
    FROM public.referrals
    WHERE reward_given = false
      AND status = 'approved'
      AND reward_release_at IS NOT NULL
      AND reward_release_at <= NOW()
    ORDER BY reward_release_at ASC
    LIMIT GREATEST(1, COALESCE(p_limit, 500))
  LOOP
    UPDATE public.referrals
    SET
      status = 'rewarded',
      reward_given = true,
      updated_at = NOW()
    WHERE id = r.id
      AND reward_given = false;

    IF FOUND THEN
      PERFORM public.credit_wallet_referral(
        r.referrer_id,
        v_credit,
        'referral',
        'Recompensa de indicação (liberação pós-prazo)',
        'order',
        r.qualified_order_id,
        jsonb_build_object('referral_id', r.id, 'referred_id', r.referred_id)
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- =============================
-- Reward delay: affiliate payout candidates
-- =============================
CREATE OR REPLACE FUNCTION public.create_affiliate_payout_candidates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min NUMERIC;
  v_mode TEXT;
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_min := GREATEST(0, public.get_setting_number('minimum_payout', 0));
  v_mode := lower(COALESCE(public.get_setting_text('affiliate_payout_mode', 'manual'), 'manual'));
  IF v_mode NOT IN ('manual', 'auto') THEN
    v_mode := 'manual';
  END IF;

  FOR r IN
    SELECT
      ao.affiliate_id,
      SUM(ao.commission_amount) AS amount
    FROM public.affiliate_orders ao
    WHERE ao.status = 'pending'
      AND ao.payout_id IS NULL
      AND (ao.reward_release_at IS NULL OR ao.reward_release_at <= NOW())
    GROUP BY ao.affiliate_id
    HAVING SUM(ao.commission_amount) >= v_min
  LOOP
    INSERT INTO public.affiliate_payouts (
      affiliate_id, amount, status, mode, meta, created_at, updated_at
    ) VALUES (
      r.affiliate_id, r.amount, 'pending', v_mode, '{}'::jsonb, NOW(), NOW()
    );

    UPDATE public.affiliate_orders
    SET
      payout_id = (
        SELECT id FROM public.affiliate_payouts p
        WHERE p.affiliate_id = r.affiliate_id
        ORDER BY p.created_at DESC
        LIMIT 1
      ),
      status = 'approved',
      updated_at = NOW()
    WHERE affiliate_id = r.affiliate_id
      AND status = 'pending'
      AND payout_id IS NULL
      AND (reward_release_at IS NULL OR reward_release_at <= NOW());

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
