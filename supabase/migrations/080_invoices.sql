-- Faturas: snapshot imutável por pedido pago (uma fatura padrão por order_id).

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  year SMALLINT PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM NOW())::INT;
  n INT;
BEGIN
  INSERT INTO public.invoice_counters (year, last_seq)
  VALUES (y::SMALLINT, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO n;
  RETURN format('INV-%s-%s', y, lpad(n::TEXT, 4, '0'));
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  invoice_kind TEXT NOT NULL DEFAULT 'invoice' CHECK (invoice_kind IN ('invoice', 'credit_note')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_standard_per_order
  ON public.invoices (order_id)
  WHERE invoice_kind = 'invoice';

CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON public.invoices (user_id, created_at DESC);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and admins can select invoices" ON public.invoices;
CREATE POLICY "Users and admins can select invoices"
  ON public.invoices
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.invoices IS 'Fatura (snapshot JSON). Gerada no servidor quando o pedido fica paid. credit_note reservado para estornos.';
COMMENT ON COLUMN public.invoices.data_json IS 'Snapshot completo: totais, itens, câmbio e pagamento no momento da emissão.';
COMMENT ON COLUMN public.invoices.invoice_kind IS 'invoice = fatura padrão; credit_note = nota de crédito (futuro).';
