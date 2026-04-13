-- admin_set_shipment_freight: optional shipping_quote_breakdown on first linked order (parity with pedido flow)

CREATE OR REPLACE FUNCTION public.admin_set_shipment_freight(
  p_shipment_id uuid,
  p_shipping_cost numeric,
  p_currency text DEFAULT 'JPY',
  p_breakdown jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids uuid[];
  v_first_order_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_shipping_cost IS NULL OR p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;
  IF p_breakdown IS NOT NULL AND jsonb_typeof(p_breakdown) <> 'object' THEN
    RAISE EXCEPTION 'Breakdown inválido';
  END IF;

  SELECT (
    SELECT COALESCE(array_agg(DISTINCT ui.order_id) FILTER (WHERE ui.order_id IS NOT NULL), ARRAY[]::uuid[])
    FROM public.shipment_items si
    JOIN public.user_inventory ui ON ui.id = si.inventory_id
    WHERE si.shipment_id = p_shipment_id
  ) INTO v_order_ids;

  UPDATE public.shipments
  SET shipping_cost = p_shipping_cost,
      shipping_currency = COALESCE(NULLIF(trim(p_currency), ''), 'JPY'),
      status = 'awaiting_payment',
      updated_at = NOW()
  WHERE id = p_shipment_id
    AND status = 'requested';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envio não encontrado ou já possui frete definido';
  END IF;

  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    v_first_order_id := v_order_ids[1];
    UPDATE public.orders
    SET shipping_cost = p_shipping_cost,
        shipping_currency = COALESCE(NULLIF(trim(p_currency), ''), 'JPY'),
        status = 'awaiting_payment',
        shipping_quote_breakdown = CASE
          WHEN p_breakdown IS NULL THEN NULL
          ELSE p_breakdown
        END
    WHERE id = v_first_order_id;

    IF array_length(v_order_ids, 1) > 1 THEN
      UPDATE public.orders
      SET shipping_cost = 0,
          shipping_currency = COALESCE(NULLIF(trim(p_currency), ''), 'JPY'),
          status = 'awaiting_payment',
          shipping_quote_breakdown = NULL
      WHERE id = ANY(v_order_ids[2:array_length(v_order_ids, 1)])
        AND status IN ('ready_for_shipment', 'products_paid');
    END IF;
  END IF;
END;
$$;
