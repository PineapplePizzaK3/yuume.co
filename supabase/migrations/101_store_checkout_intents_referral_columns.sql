-- Garante colunas de cupom/indicação em store_checkout_intents (equivalente ao 088).
-- Necessário se o banco recebeu migrations posteriores sem aplicar 088.

ALTER TABLE public.store_checkout_intents
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL;

ALTER TABLE public.store_checkout_intents
  ADD COLUMN IF NOT EXISTS referral_discount_amount numeric;

COMMENT ON COLUMN public.store_checkout_intents.referral_id IS
  'Indicação vinculada ao desconto de cupom de referral, quando aplicável.';

COMMENT ON COLUMN public.store_checkout_intents.referral_discount_amount IS
  'Valor do desconto de referral em BRL (espelho do desconto aplicado ao total).';
