-- Carteira virtual por usuário: saldo e movimentações.
-- O saldo pode ser usado para pagar frete, itens da loja e serviços futuros.
-- Créditos: adição de saldo (Stripe), reembolsos. Débitos: pagamento de pedido, loja, serviços.

-- Tabela de saldo por usuário (uma linha por usuário)
CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico de movimentações (auditoria e extrato)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2),
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'debit')),
  type TEXT NOT NULL,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN wallet_transactions.type IS 'topup, refund, order_shipping, order_service, loja, adjustment';
COMMENT ON COLUMN wallet_transactions.reference_type IS 'order, payment, product';

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created ON wallet_transactions(user_id, created_at DESC);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas sua carteira e suas transações
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own wallet_transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Inserção/atualização de saldo apenas via RPC (service role ou SECURITY DEFINER)
CREATE POLICY "No direct insert wallet" ON wallets FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct update wallet" ON wallets FOR UPDATE USING (false);
CREATE POLICY "No direct insert wallet_transactions" ON wallet_transactions FOR INSERT WITH CHECK (false);

-- RPC: creditar carteira (top-up, reembolso). Chamado pelo backend/webhook.
CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'topup',
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $credit$
DECLARE
  v_balance NUMERIC;
  v_balance_after NUMERIC;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor invalido para credito';
  END IF;

  INSERT INTO public.wallets (user_id, balance, currency, updated_at)
  VALUES (p_user_id, 0, 'BRL', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);
  v_balance_after := v_balance + p_amount;

  UPDATE public.wallets
  SET balance = v_balance_after, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, balance_after, kind, type, description, reference_type, reference_id)
  VALUES (p_user_id, p_amount, v_balance_after, 'credit', COALESCE(NULLIF(trim(p_type), ''), 'topup'), p_description, p_reference_type, p_reference_id)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'amount', p_amount,
    'balance_after', v_balance_after,
    'transaction_id', v_tx_id
  );
END;
$credit$;

-- RPC: debitar carteira (pagamento de pedido, loja, etc.). Chamado pelo backend ou RPC autenticado.
CREATE OR REPLACE FUNCTION public.wallet_debit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'order_shipping',
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $debit$
DECLARE
  v_balance NUMERIC;
  v_balance_after NUMERIC;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor invalido para debito';
  END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na carteira';
  END IF;

  v_balance_after := v_balance - p_amount;

  UPDATE public.wallets
  SET balance = v_balance_after, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (user_id, amount, balance_after, kind, type, description, reference_type, reference_id)
  VALUES (p_user_id, -p_amount, v_balance_after, 'debit', COALESCE(NULLIF(trim(p_type), ''), 'order_shipping'), p_description, p_reference_type, p_reference_id)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'amount', p_amount,
    'balance_after', v_balance_after,
    'transaction_id', v_tx_id
  );
END;
$debit$;

-- RPC: usuário autenticado paga pedido (frete) com a carteira. Valida pedido e debita.
CREATE OR REPLACE FUNCTION public.wallet_pay_order(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $payorder$
DECLARE
  v_order public.orders%ROWTYPE;
  v_amount NUMERIC;
  v_currency TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF v_order.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Pedido não está aguardando pagamento de frete';
  END IF;

  v_amount := v_order.shipping_cost;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Valor do frete não definido';
  END IF;

  v_currency := COALESCE(UPPER(TRIM(v_order.shipping_currency)), 'JPY');
  IF v_currency <> 'BRL' THEN
    RAISE EXCEPTION 'Pagamento com carteira disponível apenas para fretes em BRL';
  END IF;

  PERFORM public.wallet_debit(
    p_user_id,
    v_amount,
    'order_shipping',
    'Frete - Pedido ' || LEFT(p_order_id::text, 8),
    'order',
    p_order_id
  );

  UPDATE public.orders SET status = 'paid' WHERE id = p_order_id;

  INSERT INTO public.payments (order_id, stripe_payment_id, status, amount)
  VALUES (p_order_id, 'wallet', 'completed', v_amount);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$payorder$;
