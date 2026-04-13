-- Admin: editar linha de inventário do usuário (pacote / produtos na conta).

CREATE OR REPLACE FUNCTION public.admin_update_user_inventory(
  p_inventory_id uuid,
  p_name text,
  p_notes text,
  p_weight_kg numeric,
  p_photo_url text,
  p_video_url text,
  p_products_description text,
  p_items_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_inventory%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_row FROM public.user_inventory WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF v_row.status NOT IN ('stored', 'ready_for_shipment') THEN
    RAISE EXCEPTION 'Só é possível editar itens armazenados ou prontos para envio';
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  UPDATE public.user_inventory SET
    name = trim(p_name),
    notes = NULLIF(trim(p_notes), ''),
    weight_kg = p_weight_kg,
    photo_url = NULLIF(trim(p_photo_url), ''),
    video_url = NULLIF(trim(p_video_url), ''),
    products_description = NULLIF(trim(p_products_description), ''),
    items_count = p_items_count,
    updated_at = NOW()
  WHERE id = p_inventory_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- Painel de envios: inventário inclui armazenado + pronto; itens de envio com URLs e notas.
CREATE OR REPLACE FUNCTION public.admin_get_shipping_panel(
  p_limit_shipments INT DEFAULT 300,
  p_limit_orders INT DEFAULT 500,
  p_limit_inventory_ready INT DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shipments jsonb;
  v_orders jsonb;
  v_inventory_ready jsonb;
  v_lim_shipments INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit_shipments, 0), 300), 1), 2000);
  v_lim_orders INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit_orders, 0), 500), 1), 5000);
  v_lim_inventory INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit_inventory_ready, 0), 500), 1), 5000);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH selected_shipments AS (
    SELECT sh.*
    FROM public.shipments sh
    ORDER BY sh.created_at DESC
    LIMIT v_lim_shipments
  ),
  shipment_with_items AS (
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
            'weight_kg', ui.weight_kg,
            'items_count', ui.items_count,
            'products_description', ui.products_description,
            'notes', ui.notes,
            'photo_url', ui.photo_url,
            'video_url', ui.video_url
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
    FROM selected_shipments sh
    LEFT JOIN public.profiles pr ON pr.id = sh.user_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY (s.created_at) DESC NULLS LAST), '[]'::jsonb)
  INTO v_shipments
  FROM shipment_with_items s;

  SELECT COALESCE(jsonb_agg(row_to_json(o)::jsonb), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT o.*, pr.name AS user_name, pr.email AS user_email, s.name AS service_name
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
    LIMIT v_lim_orders
  ) o;

  SELECT COALESCE(jsonb_agg(row_to_json(inv)::jsonb), '[]'::jsonb)
  INTO v_inventory_ready
  FROM (
    SELECT ui.id, ui.user_id, ui.name, ui.order_id, ui.status, ui.weight_kg,
      ui.items_count, ui.products_description, ui.notes, ui.photo_url, ui.video_url,
      pr.name AS user_name, pr.email AS user_email
    FROM public.user_inventory ui
    LEFT JOIN public.profiles pr ON pr.id = ui.user_id
    WHERE ui.status IN ('stored', 'ready_for_shipment')
    ORDER BY ui.updated_at DESC
    LIMIT v_lim_inventory
  ) inv;

  RETURN jsonb_build_object(
    'shipments', COALESCE(v_shipments, '[]'::jsonb),
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'inventory_ready', COALESCE(v_inventory_ready, '[]'::jsonb)
  );
END;
$$;
