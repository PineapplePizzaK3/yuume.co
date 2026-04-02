-- Redirecionamento Assistido: valor em JPY que o cliente quer debitar da carteira ao pedir pré-pagamento antecipado.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS early_prepayment_wallet_jpy INTEGER NULL;

COMMENT ON COLUMN public.orders.early_prepayment_wallet_jpy IS
  'Assistido + antecipar pré-pagamento: quanto o cliente pediu para pagar já pela carteira (JPY), além do flag early_prepayment_requested.';

CREATE OR REPLACE FUNCTION public.apply_early_prepayment_wallet_jpy(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_amount int;
  v_dup boolean;
  v_debit jsonb;
  v_currency text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.order_module IS DISTINCT FROM 'assisted_buy' THEN
    RAISE EXCEPTION 'Apenas Redirecionamento Assistido';
  END IF;

  IF NOT COALESCE(v_order.early_prepayment_requested, false) THEN
    RAISE EXCEPTION 'Pré-pagamento antecipado não foi solicitado neste pedido';
  END IF;

  IF v_order.status IS DISTINCT FROM 'awaiting_quote' THEN
    RAISE EXCEPTION 'Pedido não está aguardando orçamento';
  END IF;

  v_amount := floor(COALESCE(v_order.early_prepayment_wallet_jpy, 0))::int;
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('applied', false, 'skipped', true, 'reason', 'no_amount');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.payments
    WHERE order_id = p_order_id AND stripe_payment_id = 'wallet_early_prepay'
  ) INTO v_dup;
  IF v_dup THEN
    RAISE EXCEPTION 'Carteira já foi aplicada neste pedido';
  END IF;

  SELECT COALESCE(UPPER(TRIM(currency)), 'JPY') INTO v_currency
  FROM public.wallets WHERE user_id = auth.uid();
  IF v_currency IS NULL OR v_currency <> 'JPY' THEN
    RAISE EXCEPTION 'Carteira precisa estar em JPY para este pagamento';
  END IF;

  v_debit := public.wallet_debit(
    auth.uid(),
    v_amount::numeric,
    'order_service',
    'Pré-pagamento (carteira) - Redirecionamento Assistido - Pedido ' || LEFT(p_order_id::text, 8),
    'order',
    p_order_id
  );

  INSERT INTO public.payments (order_id, stripe_payment_id, status, amount, currency)
  VALUES (p_order_id, 'wallet_early_prepay', 'completed', v_amount, 'JPY');

  RETURN jsonb_build_object(
    'applied', true,
    'applied_amount', v_amount,
    'balance_after', v_debit->'balance_after'
  );
END;
$$;

COMMENT ON FUNCTION public.apply_early_prepayment_wallet_jpy(uuid) IS
  'Cliente autenticado: debita early_prepayment_wallet_jpy da carteira (JPY) em pedido assisted_buy awaiting_quote com early_prepayment_requested.';

GRANT EXECUTE ON FUNCTION public.apply_early_prepayment_wallet_jpy(uuid) TO authenticated;
