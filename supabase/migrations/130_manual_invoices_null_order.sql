-- Suporte a faturas manuais sem pedido na plataforma (order_id NULL).
-- Garante coluna opcional e índices únicos apenas quando há order_id.

ALTER TABLE public.invoices
  ALTER COLUMN order_id DROP NOT NULL;

DROP INDEX IF EXISTS public.invoices_one_standard_per_order;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_standard_per_order
  ON public.invoices (order_id)
  WHERE invoice_kind = 'invoice' AND order_id IS NOT NULL;

DROP INDEX IF EXISTS public.invoices_one_consolidation_per_order;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_consolidation_per_order
  ON public.invoices (order_id)
  WHERE invoice_kind = 'consolidation_invoice' AND order_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.order_id IS
  'Pedido na plataforma (opcional). NULL em faturas manuais off-platform e alguns payout statements.';
