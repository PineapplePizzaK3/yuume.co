-- Permite que o usuário cancele solicitação de envio quando status = requested.
-- Reverte inventário e pedidos ao estado anterior e remove o shipment.

CREATE OR REPLACE FUNCTION public.user_cancel_shipment(p_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_status text;
  v_inventory_ids uuid[];
  v_order_ids uuid[];
  v_oid uuid;
BEGIN
  SELECT user_id, status INTO v_user_id, v_status
  FROM public.shipments WHERE id = p_shipment_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Envio não encontrado';
  END IF;
  IF auth.uid() IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_status <> 'requested' THEN
    RAISE EXCEPTION 'Só é possível cancelar envios com status Solicitado';
  END IF;

  SELECT ARRAY_AGG(inventory_id) INTO v_inventory_ids
  FROM public.shipment_items WHERE shipment_id = p_shipment_id;

  IF v_inventory_ids IS NOT NULL AND array_length(v_inventory_ids, 1) > 0 THEN
    UPDATE public.user_inventory
    SET status = 'stored'
    WHERE id = ANY(v_inventory_ids);

    SELECT ARRAY_AGG(DISTINCT order_id) INTO v_order_ids
    FROM public.user_inventory
    WHERE id = ANY(v_inventory_ids) AND order_id IS NOT NULL;

    IF v_order_ids IS NOT NULL THEN
      FOREACH v_oid IN ARRAY v_order_ids LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.user_inventory
          WHERE order_id = v_oid AND status = 'ready_for_shipment'
        ) THEN
          UPDATE public.orders
          SET status = 'stored'
          WHERE id = v_oid AND status = 'ready_for_shipment';
        END IF;
      END LOOP;
    END IF;
  END IF;

  DELETE FROM public.shipments WHERE id = p_shipment_id;
END;
$$;
