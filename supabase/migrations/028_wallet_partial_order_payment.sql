-- Suportar pagamento parcial com carteira + restante no cartão (Stripe)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wallet_applied_amount DECIMAL(12,2) DEFAULT 0;

-- RPC: aplica saldo da carteira (BRL) como parte do pagamento do pedido
CREATE OR REPLACE FUNCTION public.wallet_apply_to_order(
  p_order_id uuid,
  p_user_id uuid,
  p_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_total numeric;
  v_currency text;
  v_type text;
  v_desc text;
  v_wallet_balance numeric;
  v_remaining numeric;
  v_apply numeric;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Pedido não está aguardando pagamento';
  END IF;

  -- Determina o total a pagar (mesma lógica do wallet_pay_order / checkout)
  IF v_order.order_source = 'store' AND v_order.total_amount IS NOT NULL AND v_order.total_amount > 0 THEN
    v_total := v_order.total_amount;
    v_currency := 'BRL';
    v_type := 'loja';
    v_desc := 'Loja - Pedido ' || LEFT(p_order_id::text, 8);
  ELSIF v_order.quote_amount IS NOT NULL AND v_order.quote_amount > 0 THEN
    v_total := v_order.quote_amount;
    v_currency := COALESCE(UPPER(TRIM(v_order.quote_currency)), 'BRL');
    v_type := 'order_service';
    v_desc := 'Personal Shopping - Pedido ' || LEFT(p_order_id::text, 8);
  ELSE
    v_total := v_order.shipping_cost;
    v_currency := COALESCE(UPPER(TRIM(v_order.shipping_currency)), 'JPY');
    v_type := 'order_shipping';
    v_desc := 'Frete - Pedido ' || LEFT(p_order_id::text, 8);
  END IF;

  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'Valor não definido para este pedido';
  END IF;
  IF v_currency <> 'BRL' THEN
    RAISE EXCEPTION 'Uso de carteira disponível apenas para valores em BRL';
  END IF;

  v_remaining := v_total - COALESCE(v_order.wallet_applied_amount, 0);
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'applied_amount', 0,
      'remaining_amount', 0,
      'total_amount', v_total,
      'currency', v_currency
    );
  END IF;

  SELECT COALESCE(balance, 0) INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_user_id;

  v_apply := LEAST(
    v_remaining,
    v_wallet_balance,
    COALESCE(NULLIF(p_amount, 0), v_wallet_balance)
  );

  IF v_apply <= 0 THEN
    RETURN jsonb_build_object(
      'applied_amount', 0,
      'remaining_amount', v_remaining,
      'total_amount', v_total,
      'currency', v_currency
    );
  END IF;

  PERFORM public.wallet_debit(
    p_user_id,
    v_apply,
    v_type,
    'Pagamento parcial (carteira) - ' || v_desc,
    'order',
    p_order_id
  );

  UPDATE public.orders
  SET wallet_applied_amount = COALESCE(wallet_applied_amount, 0) + v_apply
  WHERE id = p_order_id;

  INSERT INTO public.payments (order_id, stripe_payment_id, status, amount)
  VALUES (p_order_id, 'wallet_partial', 'completed', v_apply);

  -- Recalcula restante após aplicar
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  v_remaining := v_total - COALESCE(v_order.wallet_applied_amount, 0);

  -- Se zerou, finalize como pago e execute efeitos colaterais da loja (armazenamento)
  IF v_remaining <= 0 THEN
    UPDATE public.orders SET status = 'paid' WHERE id = p_order_id;
    IF v_order.order_source = 'store' AND NOT v_order.ship_immediately THEN
      PERFORM public.store_order_add_to_inventory(p_order_id);
    END IF;
    RETURN jsonb_build_object(
      'applied_amount', v_apply,
      'remaining_amount', 0,
      'total_amount', v_total,
      'currency', v_currency,
      'paid', true
    );
  END IF;

  RETURN jsonb_build_object(
    'applied_amount', v_apply,
    'remaining_amount', v_remaining,
    'total_amount', v_total,
    'currency', v_currency,
    'paid', false
  );
END;
$$;

