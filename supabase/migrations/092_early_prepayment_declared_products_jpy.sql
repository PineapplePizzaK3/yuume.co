-- Redirecionamento Assistido: valor declarado dos produtos (antes da taxa) no pré-pagamento antecipado.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS early_prepayment_declared_products_jpy INTEGER NULL;

COMMENT ON COLUMN public.orders.early_prepayment_declared_products_jpy IS
  'Assistido + pré-pagamento antecipado: total em JPY informado pelo cliente para os produtos (links na mensagem). early_prepayment_wallet_jpy = produtos + taxa %.';
