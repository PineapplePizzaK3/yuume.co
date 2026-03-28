-- Fix for environments where gen_random_bytes() is unavailable in current search_path.
-- Replaces referral/affiliate code generators with md5-based generation (native Postgres).

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
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_referral_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

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
    v_code := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.affiliates WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Also avoid pgcrypto digest dependency in fingerprint helper.
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
  SELECT md5(
    lower(
      coalesce(trim(p_ip), '') || '|' ||
      coalesce(trim(p_user_agent), '') || '|' ||
      coalesce(trim(p_device_type), '') || '|' ||
      coalesce(trim(p_os), '') || '|' ||
      coalesce(trim(p_timezone), '')
    )
  );
$$;
