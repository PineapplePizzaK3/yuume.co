-- Cliente pode solicitar antecipação do pré-pagamento (ex.: itens de flea market / usados).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS early_prepayment_requested BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.early_prepayment_requested IS
  'Redirecionamento Assistido: cliente pediu enviar/antecipar pré-pagamento cedo para reduzir risco de esgotamento (ex.: Mercari, Yahoo Fleamarket).';
