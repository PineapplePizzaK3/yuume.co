-- Admin RPC performance pass:
-- - add bounded pagination parameters to heavy list RPCs
-- - cap large aggregates in shipping panel
-- - add support indexes for common admin sorting/filter patterns

-- Support indexes used by admin lists
CREATE INDEX IF NOT EXISTS idx_products_created_at
  ON public.products(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_name_email
  ON public.profiles(name, email);

CREATE INDEX IF NOT EXISTS idx_shipments_created_at
  ON public.shipments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_inventory_status_updated_at
  ON public.user_inventory(status, updated_at DESC);

-- Admin: orders list with pagination
CREATE OR REPLACE FUNCTION public.admin_orders_with_users(
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0,
  p_status_filter TEXT[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 1000), 1), 5000);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(o)::jsonb), '[]'::jsonb)
    FROM (
      SELECT o.*, s.name AS service_name, p.name AS user_name, p.email AS user_email
      FROM public.orders o
      LEFT JOIN public.services s ON s.id = o.service_id
      LEFT JOIN public.profiles p ON p.id = o.user_id
      WHERE (p_status_filter IS NULL OR p_status_filter = '{}'::TEXT[] OR o.status = ANY(p_status_filter))
      ORDER BY o.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) o
  );
END;
$$;

-- Admin: products list with pagination
CREATE OR REPLACE FUNCTION public.admin_list_products(
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 1000), 1), 5000);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
    FROM (
      SELECT * FROM public.products
      ORDER BY created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) p
  );
END;
$$;

-- Admin: users list with pagination
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 1000), 1), 5000);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'email', p.email,
          'name', p.name,
          'account_code', p.account_code
        )
        ORDER BY p.name NULLS LAST, p.email
      ),
      '[]'::jsonb
    )
    FROM (
      SELECT id, email, name, account_code
      FROM public.profiles
      ORDER BY name NULLS LAST, email
      LIMIT v_limit
      OFFSET v_offset
    ) p
  );
END;
$$;

-- Admin shipping panel with bounded payload size
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
      pr.name AS user_name, pr.email AS user_email
    FROM public.user_inventory ui
    LEFT JOIN public.profiles pr ON pr.id = ui.user_id
    WHERE ui.status = 'ready_for_shipment'
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
