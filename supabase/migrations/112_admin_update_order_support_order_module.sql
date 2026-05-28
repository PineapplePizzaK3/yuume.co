-- Permite que o admin salve a modalidade de Redirecionamento ao editar pedido.
-- Aceita apenas: self_buy | assisted_buy | null.

CREATE OR REPLACE FUNCTION public.admin_update_order(
  p_order_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_status text;
  v_order_module text;
  v_valid_status text[] := ARRAY[
    'pending_approval','approved','rejected','awaiting_quote','quoted',
    'awaiting_arrival','item_received','stored','ready_for_shipment',
    'awaiting_payment','paid','shipped','completed','products_paid'
  ];
  v_valid_modules text[] := ARRAY['self_buy','assisted_buy'];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_status := p_payload->>'status';
  IF v_status IS NOT NULL AND NOT (v_status = ANY(v_valid_status)) THEN
    RAISE EXCEPTION 'Status inválido: %', v_status;
  END IF;

  v_order_module := p_payload->>'order_module';
  IF (p_payload ? 'order_module')
     AND v_order_module IS NOT NULL
     AND NOT (v_order_module = ANY(v_valid_modules)) THEN
    RAISE EXCEPTION 'Módulo de pedido inválido: %', v_order_module;
  END IF;

  WITH updated AS (
    UPDATE public.orders
    SET
      message = CASE
        WHEN p_payload ? 'message'
          THEN NULLIF(trim(COALESCE(p_payload->>'message', '')), '')
        ELSE message
      END,
      service_id = CASE
        WHEN p_payload ? 'service_id'
          THEN (p_payload->>'service_id')::uuid
        ELSE service_id
      END,
      status = CASE
        WHEN p_payload ? 'status'
          THEN p_payload->>'status'
        ELSE status
      END,
      shipping_cost = CASE
        WHEN p_payload ? 'shipping_cost'
          THEN (p_payload->>'shipping_cost')::numeric
        ELSE shipping_cost
      END,
      shipping_currency = CASE
        WHEN p_payload ? 'shipping_currency'
          THEN COALESCE(NULLIF(trim(p_payload->>'shipping_currency'), ''), 'JPY')
        ELSE shipping_currency
      END,
      order_module = CASE
        WHEN p_payload ? 'order_module'
          THEN NULLIF(trim(COALESCE(p_payload->>'order_module', '')), '')
        ELSE order_module
      END,
      extra_services = CASE
        WHEN p_payload ? 'extra_services'
          THEN COALESCE((p_payload->'extra_services')::jsonb, '{}'::jsonb)
        ELSE extra_services
      END,
      quote_amount = CASE
        WHEN p_payload ? 'quote_amount'
          THEN (p_payload->>'quote_amount')::numeric
        ELSE quote_amount
      END,
      quote_currency = CASE
        WHEN p_payload ? 'quote_currency'
          THEN COALESCE(NULLIF(trim(p_payload->>'quote_currency'), ''), 'BRL')
        ELSE quote_currency
      END
    WHERE id = p_order_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result
  FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  RETURN v_result;
END;
$$;
