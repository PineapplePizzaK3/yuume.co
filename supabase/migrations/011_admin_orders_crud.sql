-- Admin CRUD para pedidos
-- Executar após 010

-- RPC: admin edita dados de pedido (message, service_id, status, shipping)
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
  v_valid text[] := ARRAY['requested','received','consolidated','awaiting_payment','paid','shipped'];
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

-- RPC: admin remove pedido
CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.orders WHERE id = p_order_id;
END;
$$;
