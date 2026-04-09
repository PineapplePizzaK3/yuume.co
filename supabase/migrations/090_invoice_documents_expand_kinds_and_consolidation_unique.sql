-- Expande tipos de documentos financeiros em public.invoices
-- e garante unicidade de invoice de consolidação por pedido.

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_invoice_kind_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_kind_check
  CHECK (
    invoice_kind IN (
      'invoice',
      'credit_note',
      'consolidation_invoice',
      'payout_statement'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_consolidation_per_order
  ON public.invoices (order_id)
  WHERE invoice_kind = 'consolidation_invoice';

COMMENT ON COLUMN public.invoices.invoice_kind IS
  'invoice = fatura principal; consolidation_invoice = fatura de consolidação/frete; credit_note = ajuste/estorno; payout_statement = repasse de afiliado/referral.';
