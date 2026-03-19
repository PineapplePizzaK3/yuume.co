-- Painel de envios para admin: solicitações de envio e pedidos relacionados
CREATE OR REPLACE FUNCTION public.admin_get_shipping_panel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipments jsonb;
  v_orders jsonb;
  v_inventory_ready jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Shipments com itens, usuário e pedidos vinculados
  WITH shipment_with_items AS (
    SELECT
      sh.id,
      sh.user_id,
      pr.name AS user_name,
      pr.email AS user_email,
      sh.status,
      sh.shipping_cost,
      sh.shipping_currency,
      sh.tracking_code,
      sh.extra_services,
      sh.created_at,
      sh.updated_at,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'inventory_id', ui.id,
            'inventory_name', ui.name,
            'order_id', ui.order_id,
            'status', ui.status,
            'weight_kg', ui.weight_kg
          )
        ), '[]'::jsonb)
        FROM public.shipment_items si
        JOIN public.user_inventory ui ON ui.id = si.inventory_id
        WHERE si.shipment_id = sh.id
      ) AS items,
      (
        SELECT COALESCE(jsonb_agg(DISTINCT ui.order_id) FILTER (WHERE ui.order_id IS NOT NULL), '[]'::jsonb)
        FROM public.shipment_items si
        JOIN public.user_inventory ui ON ui.id = si.inventory_id
        WHERE si.shipment_id = sh.id
      ) AS order_ids
    FROM public.shipments sh
    LEFT JOIN public.profiles pr ON pr.id = sh.user_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY (s.created_at) DESC NULLS LAST), '[]'::jsonb)
  INTO v_shipments
  FROM shipment_with_items s;

  -- Pedidos em fluxo de envio (ready_for_shipment, products_paid, awaiting_payment, paid, shipped)
  SELECT COALESCE(jsonb_agg(row_to_json(o)::jsonb), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT o.*, pr.name AS user_name, pr.email AS user_email,
      s.name AS service_name
    FROM public.orders o
    LEFT JOIN public.profiles pr ON pr.id = o.user_id
    LEFT JOIN public.services s ON s.id = o.service_id
    WHERE o.status IN ('ready_for_shipment', 'products_paid', 'awaiting_payment', 'paid', 'shipped', 'completed')
    ORDER BY
      CASE o.status
        WHEN 'ready_for_shipment' THEN 1
        WHEN 'products_paid' THEN 2
        WHEN 'awaiting_payment' THEN 3
        WHEN 'paid' THEN 4
        WHEN 'shipped' THEN 5
        WHEN 'completed' THEN 6
        ELSE 7
      END,
      o.created_at DESC
  ) o;

  -- Inventário pronto para envio (sem shipment ou como referência)
  SELECT COALESCE(jsonb_agg(row_to_json(inv)::jsonb), '[]'::jsonb)
  INTO v_inventory_ready
  FROM (
    SELECT ui.id, ui.user_id, ui.name, ui.order_id, ui.status, ui.weight_kg,
      pr.name AS user_name, pr.email AS user_email
    FROM public.user_inventory ui
    LEFT JOIN public.profiles pr ON pr.id = ui.user_id
    WHERE ui.status = 'ready_for_shipment'
    ORDER BY ui.updated_at DESC
  ) inv;

  RETURN jsonb_build_object(
    'shipments', COALESCE(v_shipments, '[]'::jsonb),
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'inventory_ready', COALESCE(v_inventory_ready, '[]'::jsonb)
  );
END;
$$;
