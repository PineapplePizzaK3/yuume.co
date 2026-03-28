-- Diretriz monetaria:
-- - JPY = moeda base dos registros de pagamento
-- - BRL = legado/conversao

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS currency TEXT;

-- Backfill com heuristica para dados antigos.
UPDATE public.payments p
SET currency = CASE
  WHEN p.currency IS NOT NULL AND trim(p.currency) <> '' THEN upper(trim(p.currency))
  WHEN p.order_id IS NULL THEN 'JPY'
  WHEN p.stripe_payment_id = 'wallet' AND upper(COALESCE(o.shipping_currency, '')) = 'BRL' THEN 'BRL'
  WHEN o.order_source = 'store'
    AND o.total_amount IS NOT NULL
    AND abs(COALESCE(p.amount, 0) - o.total_amount) < 0.01 THEN 'BRL'
  WHEN o.quote_amount IS NOT NULL
    AND upper(COALESCE(o.quote_currency, '')) = 'BRL'
    AND abs(COALESCE(p.amount, 0) - o.quote_amount) < 0.01 THEN 'BRL'
  WHEN o.shipping_cost IS NOT NULL
    AND upper(COALESCE(o.shipping_currency, '')) = 'BRL'
    AND abs(COALESCE(p.amount, 0) - o.shipping_cost) < 0.01 THEN 'BRL'
  ELSE 'JPY'
END
FROM public.orders o
WHERE p.order_id = o.id;

UPDATE public.payments
SET currency = 'JPY'
WHERE currency IS NULL OR trim(currency) = '';

ALTER TABLE public.payments
ALTER COLUMN currency SET DEFAULT 'JPY';

ALTER TABLE public.payments
ALTER COLUMN currency SET NOT NULL;

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_currency_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_currency_check CHECK (currency IN ('JPY', 'BRL'));

COMMENT ON COLUMN public.payments.currency IS
'Moeda do registro de pagamento. Regra atual: JPY como base; BRL apenas legado/conversao.';
