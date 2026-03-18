-- Permite ao admin incluir uma mensagem/descrição no orçamento (salva em orders.message)
CREATE OR REPLACE FUNCTION public.admin_set_quote(
  p_order_id uuid,
  p_quote_amount numeric,
  p_currency text DEFAULT 'BRL',
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_quote_amount IS NULL OR p_quote_amount < 0 THEN
    RAISE EXCEPTION 'Valor do orçamento inválido';
  END IF;

  UPDATE public.orders
  SET quote_amount = p_quote_amount,
      quote_currency = COALESCE(NULLIF(trim(p_currency), ''), 'BRL'),
      message = CASE WHEN p_message IS NULL THEN message ELSE NULLIF(trim(p_message), '') END,
      status = 'awaiting_payment'
  WHERE id = p_order_id
  RETURNING to_jsonb(orders.*) INTO v_result;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN v_result;
END;
$$;

