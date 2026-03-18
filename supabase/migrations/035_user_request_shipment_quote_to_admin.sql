-- Quando o usuário solicita envio em Meus Produtos:
-- 1) Marca os itens do inventário como ready_for_shipment
-- 2) Atualiza os orders vinculados para ready_for_shipment
--    para que o admin consiga abrir "Definir frete" e retornar o orçamento ao usuário.

CREATE OR REPLACE FUNCTION public.user_request_shipment_quote_to_admin(
  p_user_id uuid,
  p_inventory_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids uuid[];
  v_updated_inventory integer := 0;
  v_updated_orders integer := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_inventory_ids IS NULL OR array_length(p_inventory_ids, 1) IS NULL OR array_length(p_inventory_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Nenhum item de inventário informado';
  END IF;

  -- Marca inventário como pronto para envio
  UPDATE public.user_inventory
  SET status = 'ready_for_shipment'
  WHERE user_id = p_user_id
    AND id = ANY(p_inventory_ids)
    AND status IN ('stored', 'ready_for_shipment');

  GET DIAGNOSTICS v_updated_inventory = ROW_COUNT;

  -- Descobre orders vinculados a esses itens
  SELECT ARRAY_AGG(DISTINCT order_id)
  INTO v_order_ids
  FROM public.user_inventory
  WHERE user_id = p_user_id
    AND id = ANY(p_inventory_ids)
    AND order_id IS NOT NULL;

  IF v_order_ids IS NULL OR array_length(v_order_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'updated_inventory', v_updated_inventory,
      'updated_orders', 0,
      'order_ids', '[]'::jsonb
    );
  END IF;

  -- Atualiza pedidos para que o admin consiga "Definir frete"
  -- Evitamos sobrescrever orders já em produtos_paid (fluxo de envio imediato).
  UPDATE public.orders
  SET status = 'ready_for_shipment'
  WHERE id = ANY(v_order_ids)
    AND status IN ('stored', 'paid', 'ready_for_shipment');

  GET DIAGNOSTICS v_updated_orders = ROW_COUNT;

  RETURN jsonb_build_object(
    'updated_inventory', v_updated_inventory,
    'updated_orders', v_updated_orders,
    'order_ids', COALESCE(to_jsonb(v_order_ids), '[]'::jsonb)
  );
END;
$$;

