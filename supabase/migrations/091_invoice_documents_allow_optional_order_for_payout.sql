-- Permite documentos financeiros sem order_id (ex.: payout statement)
-- mantendo invoice/credit_note referenciando pedido conforme regra de aplicação.

ALTER TABLE public.invoices
  ALTER COLUMN order_id DROP NOT NULL;
