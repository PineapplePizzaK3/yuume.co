-- Compatibility patch for environments that missed referral coupon schema migrations.
-- Safe to run multiple times.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origin_referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL;

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_origin_type_check;
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_origin_type_check CHECK (origin_type IN ('manual', 'referral'));

CREATE INDEX IF NOT EXISTS idx_coupons_owner_user ON public.coupons(owner_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_origin_referral_unique
  ON public.coupons(origin_referral_id)
  WHERE origin_type = 'referral' AND origin_referral_id IS NOT NULL;

DROP POLICY IF EXISTS "Authenticated users can read eligible coupons" ON public.coupons;
DROP POLICY IF EXISTS "Authenticated users can validate coupons" ON public.coupons;
CREATE POLICY "Authenticated users can read eligible coupons" ON public.coupons
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (owner_user_id IS NULL OR owner_user_id = auth.uid())
  );
