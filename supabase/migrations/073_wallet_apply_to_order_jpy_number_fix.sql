-- Migration 073: Fix wallet_apply_to_order_jpy SQL error (Number(...))
-- Root cause: JavaScript function Number(...) was used in PL/pgSQL condition.
-- Fix: use native numeric comparison.

CREATE OR REPLACE FUNCTION public.wallet_apply_to_order_jpy(
  p_order_id uuid,
  p_user_id uuid,
  p_total_amount_jpy numeric,
  p_amount_jpy numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_wallet_balance numeric;
  v_wallet_currency text;
  v_apply numeric;
  v_remaining_after numeric;
  v_remaining numeric;
  v_type text;
  v_desc text;
  v_new_status text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_total_amount_jpy IS NULL OR p_total_amount_jpy <= 0 THEN
    RAISE EXCEPTION 'Total inválido para aplicação de carteira (JPY)';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Pedido não está aguardando pagamento';
  END IF;

  SELECT balance, COALESCE(UPPER(TRIM(currency)), 'JPY') INTO v_wallet_balance, v_wallet_currency
  FROM public.wallets
  WHERE user_id = p_user_id;

  v_wallet_balance := COALESCE(v_wallet_balance, 0);

  IF COALESCE(v_wallet_currency, 'JPY') <> 'JPY' THEN
    RAISE EXCEPTION 'Carteira precisa estar em JPY';
  END IF;

  v_remaining := p_total_amount_jpy - COALESCE(v_order.wallet_applied_amount, 0);
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'applied_amount', 0,
      'remaining_amount', 0,
      'total_amount', p_total_amount_jpy,
      'currency', 'JPY',
      'paid', true
    );
  END IF;

  IF p_amount_jpy IS NULL OR p_amount_jpy <= 0 THEN
    v_apply := LEAST(v_remaining, v_wallet_balance);
  ELSE
    v_apply := LEAST(v_remaining, v_wallet_balance, p_amount_jpy);
  END IF;

  IF v_apply <= 0 THEN
    RETURN jsonb_build_object(
      'applied_amount', 0,
      'remaining_amount', v_remaining,
      'total_amount', p_total_amount_jpy,
      'currency', 'JPY',
      'paid', false
    );
  END IF;

  -- Tipo/descrição para extrato (exibição)
  IF v_order.order_source = 'store' THEN
    v_type := 'loja';
    v_desc := 'Loja - Pedido ' || LEFT(p_order_id::text, 8);
  ELSIF v_order.quote_amount IS NOT NULL AND v_order.quote_amount > 0 THEN
    v_type := 'order_service';
    v_desc := 'Personal Shopping - Pedido ' || LEFT(p_order_id::text, 8);
  ELSE
    v_type := 'order_shipping';
    v_desc := 'Frete - Pedido ' || LEFT(p_order_id::text, 8);
  END IF;

  PERFORM public.wallet_debit(
    p_user_id,
    v_apply,
    v_type,
    'Aplicação de carteira (JPY) - ' || v_desc,
    'order',
    p_order_id
  );

  UPDATE public.orders
  SET wallet_applied_amount = COALESCE(wallet_applied_amount, 0) + v_apply
  WHERE id = p_order_id;

  -- Registra a parte paga pela carteira (para histórico/ledger)
  INSERT INTO public.payments (order_id, stripe_payment_id, status, amount)
  VALUES (p_order_id, 'wallet_jpy', 'completed', v_apply);

  v_remaining_after := v_remaining - v_apply;

  -- Se cobriu tudo: finaliza pedido
  IF v_remaining_after <= 0 THEN
    v_new_status := CASE
      WHEN v_order.order_source = 'store' AND v_order.ship_immediately THEN 'products_paid'
      ELSE 'paid'
    END;

    UPDATE public.orders
    SET status = v_new_status
    WHERE id = p_order_id AND status = 'awaiting_payment';

    IF v_order.order_source = 'store' AND NOT v_order.ship_immediately THEN
      -- Somente quando o pedido vai para inventário após ser pago
      PERFORM public.store_order_add_to_inventory(p_order_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'applied_amount', v_apply,
    'remaining_amount', GREATEST(v_remaining_after, 0),
    'total_amount', p_total_amount_jpy,
    'currency', 'JPY',
    'paid', (v_remaining_after <= 0)
  );
END;
$$;
