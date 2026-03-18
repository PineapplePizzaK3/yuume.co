-- Fluxo de pedidos: incluir status "order_paid" (pagamento do pedido recebido).
-- Sequência: pedido → pagamento do pedido → recebimento (serviços extras) → cliente pede envio → consolidamos e definimos frete → cliente paga frete → enviamos.

-- Atualizar RPC admin_update_order_status para aceitar order_paid
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_valid text[] := ARRAY['requested','order_paid','received','consolidated','awaiting_payment','paid','shipped'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NOT (p_status = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  WITH updated AS (
    UPDATE public.orders SET status = p_status WHERE id = p_order_id RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  RETURN v_result;
END;
$$;

-- Atualizar RPC admin_update_order para aceitar order_paid
CREATE OR REPLACE FUNCTION public.admin_update_order(
  p_order_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_status text;
  v_valid text[] := ARRAY['requested','order_paid','received','consolidated','awaiting_payment','paid','shipped'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_status := p_payload->>'status';
  IF v_status IS NOT NULL AND NOT (v_status = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  IF p_payload ? 'shipping_cost' THEN
    IF (p_payload->>'shipping_cost') IS NOT NULL AND (p_payload->>'shipping_cost')::numeric < 0 THEN
      RAISE EXCEPTION 'Valor do frete inválido';
    END IF;
  END IF;

  WITH updated AS (
    UPDATE public.orders
    SET
      message = CASE
        WHEN p_payload ? 'message' THEN NULLIF(trim(COALESCE(p_payload->>'message', '')), '')
        ELSE message
      END,
      service_id = CASE
        WHEN p_payload ? 'service_id' THEN (p_payload->>'service_id')::uuid
        ELSE service_id
      END,
      status = CASE
        WHEN p_payload ? 'status' THEN p_payload->>'status'
        ELSE status
      END,
      shipping_cost = CASE
        WHEN p_payload ? 'shipping_cost' THEN (p_payload->>'shipping_cost')::numeric
        ELSE shipping_cost
      END,
      shipping_currency = CASE
        WHEN p_payload ? 'shipping_currency' THEN COALESCE(NULLIF(trim(p_payload->>'shipping_currency'), ''), 'JPY')
        ELSE shipping_currency
      END
    WHERE id = p_order_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  RETURN v_result;
END;
$$;
