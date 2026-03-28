-- Referral + Affiliate core schema and settlement engine.
-- Systems are independent and only one can be applied per order.

-- =============================
-- System settings (admin-configurable)
-- =============================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system settings" ON public.system_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" ON public.system_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.system_settings (key, value)
VALUES
  ('referral_discount_value', jsonb_build_object('amount', 20)),
  ('referral_credit_value', jsonb_build_object('amount', 30)),
  ('default_commission_rate', jsonb_build_object('percent', 10)),
  ('minimum_payout', jsonb_build_object('amount', 100)),
  ('affiliate_enabled', jsonb_build_object('enabled', true)),
  ('service_fee_percent', jsonb_build_object('percent', 8)),
  ('affiliate_payout_mode', jsonb_build_object('mode', 'manual'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_setting_number(
  p_key TEXT,
  p_default NUMERIC DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
  v_out NUMERIC;
BEGIN
  SELECT value INTO v_value
  FROM public.system_settings
  WHERE key = p_key;

  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;

  v_out := COALESCE(
    NULLIF(v_value->>'amount', '')::NUMERIC,
    NULLIF(v_value->>'percent', '')::NUMERIC,
    p_default
  );
  RETURN COALESCE(v_out, p_default);
EXCEPTION WHEN OTHERS THEN
  RETURN p_default;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_setting_boolean(
  p_key TEXT,
  p_default BOOLEAN DEFAULT false
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
  v_raw TEXT;
BEGIN
  SELECT value INTO v_value
  FROM public.system_settings
  WHERE key = p_key;

  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;

  v_raw := COALESCE(v_value->>'enabled', v_value->>'value', '');
  IF lower(v_raw) IN ('true', 't', '1', 'yes', 'on') THEN
    RETURN true;
  END IF;
  IF lower(v_raw) IN ('false', 'f', '0', 'no', 'off') THEN
    RETURN false;
  END IF;
  RETURN p_default;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_setting_text(
  p_key TEXT,
  p_default TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
  v_out TEXT;
BEGIN
  SELECT value INTO v_value
  FROM public.system_settings
  WHERE key = p_key;

  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;

  v_out := COALESCE(v_value->>'mode', v_value->>'value', p_default);
  RETURN COALESCE(v_out, p_default);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_system_settings(p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'Payload inválido';
  END IF;

  FOR r IN SELECT key, value FROM jsonb_each(p_payload)
  LOOP
    INSERT INTO public.system_settings (key, value, updated_by, updated_at)
    VALUES (r.key, COALESCE(r.value, '{}'::jsonb), auth.uid(), NOW())
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
END;
$$;

-- =============================
-- Referral
-- =============================
CREATE TABLE IF NOT EXISTS public.user_referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_used TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded', 'cancelled')),
  reward_given BOOLEAN NOT NULL DEFAULT false,
  qualified_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  qualified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_id, referred_id),
  CHECK (referrer_id <> referred_id)
);

CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'debit')),
  type TEXT NOT NULL DEFAULT 'referral' CHECK (type IN ('referral', 'referral_discount', 'adjustment')),
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral code" ON public.user_referral_codes;
CREATE POLICY "Users can view own referral code" ON public.user_referral_codes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own referrals as referrer or referred" ON public.referrals;
CREATE POLICY "Users can view own referrals as referrer or referred" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits" ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own credit ledger" ON public.credit_ledger;
CREATE POLICY "Users can view own credit ledger" ON public.credit_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_pending ON public.referrals(referred_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON public.credit_ledger(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ensure_user_credit(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, updated_at)
  VALUES (p_user_id, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_wallet_referral(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'referral',
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  PERFORM public.ensure_user_credit(p_user_id);

  UPDATE public.user_credits
  SET
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  SELECT balance INTO v_balance
  FROM public.user_credits
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_ledger (
    user_id, amount, kind, type, description, reference_type, reference_id, meta
  ) VALUES (
    p_user_id,
    ABS(p_amount),
    CASE WHEN p_amount >= 0 THEN 'credit' ELSE 'debit' END,
    COALESCE(NULLIF(trim(p_type), ''), 'referral'),
    p_description,
    p_reference_type,
    p_reference_id,
    COALESCE(p_meta, '{}'::jsonb)
  );

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_referral_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_code TEXT;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  SELECT code INTO v_code
  FROM public.user_referral_codes
  WHERE user_id = v_uid;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := public.generate_referral_code();
  INSERT INTO public.user_referral_codes (user_id, code, created_at, updated_at)
  VALUES (v_uid, v_code, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
  RETURNING code INTO v_code;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_referral_on_signup(
  p_referred_user_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred UUID;
  v_referrer UUID;
  v_existing UUID;
BEGIN
  v_referred := p_referred_user_id;
  IF v_referred IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'referred_user_id obrigatório');
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code obrigatório');
  END IF;

  SELECT user_id INTO v_referrer
  FROM public.user_referral_codes
  WHERE code = upper(trim(p_code))
  LIMIT 1;

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código inválido');
  END IF;

  IF v_referrer = v_referred THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Auto referência não permitida');
  END IF;

  SELECT id INTO v_existing
  FROM public.referrals
  WHERE referred_id = v_referred
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Usuário já possui referral');
  END IF;

  INSERT INTO public.referrals (
    referrer_id, referred_id, code_used, status, reward_given, created_at, updated_at
  ) VALUES (
    v_referrer, v_referred, upper(trim(p_code)), 'pending', false, NOW(), NOW()
  )
  ON CONFLICT (referrer_id, referred_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'referrer_id', v_referrer, 'referred_id', v_referred);
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_referral_from_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  SELECT COALESCE(raw_user_meta_data->>'referral_code', '')
  INTO v_code
  FROM auth.users
  WHERE id = NEW.id;

  IF v_code IS NOT NULL AND trim(v_code) <> '' THEN
    PERFORM public.bind_referral_on_signup(NEW.id, v_code);
  END IF;

  -- Ensure both referral code and credit wallet exist.
  PERFORM public.get_or_create_referral_code(NEW.id);
  PERFORM public.ensure_user_credit(NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bind_referral_from_profile_insert ON public.profiles;
CREATE TRIGGER trg_bind_referral_from_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.bind_referral_from_profile_insert();

-- =============================
-- Affiliate
-- =============================
CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC(7,4),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  payout_method_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  session_key TEXT,
  source TEXT,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'auto')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  payout_id UUID REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL,
  service_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own affiliate profile" ON public.affiliates;
CREATE POLICY "Users can read own affiliate profile" ON public.affiliates
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can read own affiliate clicks" ON public.affiliate_clicks;
CREATE POLICY "Users can read own affiliate clicks" ON public.affiliate_clicks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_clicks.affiliate_id
        AND (a.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Users can read own affiliate orders" ON public.affiliate_orders;
CREATE POLICY "Users can read own affiliate orders" ON public.affiliate_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_orders.affiliate_id
        AND (a.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Users can read own affiliate payouts" ON public.affiliate_payouts;
CREATE POLICY "Users can read own affiliate payouts" ON public.affiliate_payouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.affiliates a
      WHERE a.id = affiliate_payouts.affiliate_id
        AND (a.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_created ON public.affiliate_clicks(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_session ON public.affiliate_clicks(session_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_affiliate_status ON public.affiliate_orders(affiliate_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_status ON public.affiliate_payouts(affiliate_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.affiliates WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_affiliate(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_row public.affiliates%ROWTYPE;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  SELECT * INTO v_row
  FROM public.affiliates
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_row.id IS NULL THEN
    INSERT INTO public.affiliates (user_id, code, commission_rate, status, created_at, updated_at)
    VALUES (v_uid, public.generate_affiliate_code(), NULL, 'active', NOW(), NOW())
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'user_id', v_row.user_id,
    'code', v_row.code,
    'commission_rate', v_row.commission_rate,
    'status', v_row.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_affiliate_click(
  p_code TEXT,
  p_session_key TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_utm JSONB DEFAULT '{}'::jsonb,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id UUID;
  v_row public.affiliate_clicks%ROWTYPE;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Código ausente');
  END IF;

  IF NOT public.get_setting_boolean('affiliate_enabled', true) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Programa de afiliados desativado');
  END IF;

  SELECT id INTO v_affiliate_id
  FROM public.affiliates
  WHERE code = lower(trim(p_code))
    AND status = 'active'
  LIMIT 1;

  IF v_affiliate_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Afiliado não encontrado');
  END IF;

  INSERT INTO public.affiliate_clicks (
    affiliate_id, session_key, source, utm, ip_hash, user_agent_hash, created_at
  ) VALUES (
    v_affiliate_id, NULLIF(trim(p_session_key), ''), NULLIF(trim(p_source), ''), COALESCE(p_utm, '{}'::jsonb),
    NULLIF(trim(p_ip_hash), ''), NULLIF(trim(p_user_agent_hash), ''), NOW()
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'affiliate_id', v_row.affiliate_id,
    'session_key', v_row.session_key
  );
END;
$$;

-- =============================
-- Order attribution + settlement
-- =============================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acquisition_mode TEXT DEFAULT 'none' CHECK (acquisition_mode IN ('none', 'referral', 'affiliate')),
  ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS referral_discount_amount NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_orders_acquisition_mode ON public.orders(acquisition_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_referral_id ON public.orders(referral_id);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate_id ON public.orders(affiliate_id);

CREATE OR REPLACE FUNCTION public.get_order_charge_amount(order_row public.orders)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF order_row.order_source = 'store' AND order_row.total_amount IS NOT NULL AND order_row.total_amount > 0 THEN
    RETURN order_row.total_amount;
  END IF;
  IF order_row.quote_amount IS NOT NULL AND order_row.quote_amount > 0 THEN
    RETURN order_row.quote_amount;
  END IF;
  IF order_row.shipping_cost IS NOT NULL AND order_row.shipping_cost > 0 THEN
    RETURN order_row.shipping_cost;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_order_acquisition(
  p_order_id UUID,
  p_user_id UUID,
  p_mode TEXT DEFAULT 'none',
  p_affiliate_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
  v_order public.orders%ROWTYPE;
  v_referral public.referrals%ROWTYPE;
  v_affiliate public.affiliates%ROWTYPE;
  v_discount NUMERIC := 0;
BEGIN
  v_mode := lower(COALESCE(trim(p_mode), 'none'));
  IF v_mode NOT IN ('none', 'referral', 'affiliate') THEN
    v_mode := 'none';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND user_id = p_user_id
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não encontrado');
  END IF;
  IF v_order.status <> 'awaiting_payment' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pedido não elegível');
  END IF;

  IF v_mode = 'referral' THEN
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE referred_id = p_user_id
      AND status IN ('pending', 'qualified')
      AND reward_given = false
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_referral.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Referral não elegível');
    END IF;

    v_discount := GREATEST(0, public.get_setting_number('referral_discount_value', 0));

    UPDATE public.orders
    SET
      acquisition_mode = 'referral',
      referral_id = v_referral.id,
      affiliate_id = NULL,
      referral_discount_amount = v_discount
    WHERE id = p_order_id;

    RETURN jsonb_build_object('ok', true, 'mode', 'referral', 'discount_amount', v_discount, 'referral_id', v_referral.id);
  END IF;

  IF v_mode = 'affiliate' THEN
    IF NOT public.get_setting_boolean('affiliate_enabled', true) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Programa de afiliados desativado');
    END IF;

    IF p_affiliate_code IS NULL OR trim(p_affiliate_code) = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Código de afiliado ausente');
    END IF;

    SELECT * INTO v_affiliate
    FROM public.affiliates
    WHERE code = lower(trim(p_affiliate_code))
      AND status = 'active'
    LIMIT 1;

    IF v_affiliate.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Afiliado inválido');
    END IF;

    IF v_affiliate.user_id IS NOT NULL AND v_affiliate.user_id = p_user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Auto-afiliado não permitido');
    END IF;

    UPDATE public.orders
    SET
      acquisition_mode = 'affiliate',
      affiliate_id = v_affiliate.id,
      referral_id = NULL,
      referral_discount_amount = NULL
    WHERE id = p_order_id;

    RETURN jsonb_build_object('ok', true, 'mode', 'affiliate', 'affiliate_id', v_affiliate.id);
  END IF;

  UPDATE public.orders
  SET
    acquisition_mode = 'none',
    affiliate_id = NULL,
    referral_id = NULL,
    referral_discount_amount = NULL
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'mode', 'none');
END;
$$;

CREATE OR REPLACE FUNCTION public.qualify_referral_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_credit NUMERIC;
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

  IF NEW.status NOT IN ('paid', 'products_paid', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ref
  FROM public.referrals
  WHERE id = NEW.referral_id
  LIMIT 1;

  IF v_ref.id IS NULL OR v_ref.reward_given THEN
    RETURN NEW;
  END IF;

  v_credit := GREATEST(0, public.get_setting_number('referral_credit_value', 0));

  UPDATE public.referrals
  SET
    status = 'rewarded',
    reward_given = true,
    qualified_order_id = NEW.id,
    qualified_at = NOW(),
    updated_at = NOW()
  WHERE id = v_ref.id
    AND reward_given = false;

  IF FOUND AND v_credit > 0 THEN
    PERFORM public.credit_wallet_referral(
      v_ref.referrer_id,
      v_credit,
      'referral',
      'Recompensa de indicação',
      'order',
      NEW.id,
      jsonb_build_object('referral_id', v_ref.id, 'referred_id', v_ref.referred_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qualify_referral_on_paid ON public.orders;
CREATE TRIGGER trg_qualify_referral_on_paid
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.qualify_referral_on_paid();

CREATE OR REPLACE FUNCTION public.finalize_affiliate_commission_on_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_total NUMERIC;
  v_service_fee_percent NUMERIC;
  v_service_fee NUMERIC;
  v_default_rate NUMERIC;
  v_rate NUMERIC;
  v_commission NUMERIC;
  v_affiliate public.affiliates%ROWTYPE;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.acquisition_mode <> 'affiliate' OR NEW.affiliate_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status OR NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliate_orders WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_affiliate
  FROM public.affiliates
  WHERE id = NEW.affiliate_id
  LIMIT 1;
  IF v_affiliate.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_order_total := GREATEST(0, public.get_order_charge_amount(NEW));
  v_service_fee_percent := GREATEST(0, public.get_setting_number('service_fee_percent', 0));
  v_service_fee := ROUND(v_order_total * (v_service_fee_percent / 100.0), 2);
  v_default_rate := GREATEST(0, public.get_setting_number('default_commission_rate', 0));
  v_rate := GREATEST(0, COALESCE(v_affiliate.commission_rate, v_default_rate));
  v_commission := ROUND(v_service_fee * (v_rate / 100.0), 2);

  UPDATE public.orders
  SET service_fee_amount = v_service_fee
  WHERE id = NEW.id;

  INSERT INTO public.affiliate_orders (
    affiliate_id, order_id, service_fee_amount, commission_rate, commission_amount, status, finalized_at, created_at, updated_at
  ) VALUES (
    NEW.affiliate_id, NEW.id, v_service_fee, v_rate, v_commission, 'pending', NOW(), NOW(), NOW()
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalize_affiliate_commission_on_completed ON public.orders;
CREATE TRIGGER trg_finalize_affiliate_commission_on_completed
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.finalize_affiliate_commission_on_completed();

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
      AND payout_id IS NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_process_affiliate_auto_payouts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT;
  v_count INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_mode := lower(COALESCE(public.get_setting_text('affiliate_payout_mode', 'manual'), 'manual'));
  IF v_mode <> 'auto' THEN
    RETURN 0;
  END IF;

  UPDATE public.affiliate_payouts
  SET
    status = 'paid',
    paid_at = NOW(),
    updated_at = NOW(),
    approved_by = COALESCE(approved_by, auth.uid())
  WHERE status IN ('pending', 'approved')
    AND mode = 'auto';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.affiliate_orders
  SET
    status = 'paid',
    updated_at = NOW()
  WHERE payout_id IN (
    SELECT id FROM public.affiliate_payouts WHERE status = 'paid' AND mode = 'auto'
  )
    AND status <> 'paid';

  RETURN v_count;
END;
$$;

-- Notify admins when payout needs action.
CREATE OR REPLACE FUNCTION public.notify_admin_affiliate_payout_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins_action_required(
      'admin_affiliate_payout_pending',
      'Payout de afiliado pendente',
      'Payout ' || LEFT(NEW.id::text, 8) || '… aguardando aprovação/pagamento.',
      jsonb_build_object('payout_id', NEW.id, 'affiliate_id', NEW.affiliate_id, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_affiliate_payout_pending ON public.affiliate_payouts;
CREATE TRIGGER trg_notify_admin_affiliate_payout_pending
AFTER INSERT ON public.affiliate_payouts
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_affiliate_payout_pending();

