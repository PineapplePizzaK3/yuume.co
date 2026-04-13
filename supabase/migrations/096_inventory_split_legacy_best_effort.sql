-- Split inventory package registration by product line (best-effort rollout).
-- Keeps backward compatibility with legacy payloads and data.

CREATE OR REPLACE FUNCTION public.admin_register_package(
  p_user_id uuid,
  p_products_description text DEFAULT NULL,
  p_items_count integer DEFAULT NULL,
  p_weight_kg numeric DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_products jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_pkg public.user_inventory%ROWTYPE;
  v_first_pkg public.user_inventory%ROWTYPE;
  v_inserted_count integer := 0;
  v_name text;
  v_qty integer;
  v_price numeric;
  v_weight_share numeric;
  v_line_description text;
  v_total_units integer := 0;
  v_legacy_description text;
  v_legacy_items_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- New format: split one inventory row per product line.
  IF p_products IS NOT NULL AND jsonb_typeof(p_products) = 'array' AND jsonb_array_length(p_products) > 0 THEN
    SELECT COALESCE(
      SUM(
        GREATEST(
          1,
          CASE
            WHEN COALESCE(item->>'quantity', '') ~ '^[0-9]+$' THEN (item->>'quantity')::int
            ELSE 1
          END
        )
      ),
      0
    )
    INTO v_total_units
    FROM jsonb_array_elements(p_products) AS t(item)
    WHERE NULLIF(trim(COALESCE(item->>'name', '')), '') IS NOT NULL;

    FOR v_item IN
      SELECT item
      FROM jsonb_array_elements(p_products) AS t(item)
    LOOP
      v_name := NULLIF(trim(COALESCE(v_item->>'name', '')), '');
      IF v_name IS NULL THEN
        CONTINUE;
      END IF;

      v_qty := GREATEST(
        1,
        CASE
          WHEN COALESCE(v_item->>'quantity', '') ~ '^[0-9]+$' THEN (v_item->>'quantity')::int
          ELSE 1
        END
      );

      IF COALESCE(v_item->>'price', '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
        v_price := (v_item->>'price')::numeric;
      ELSE
        v_price := NULL;
      END IF;

      v_weight_share := CASE
        WHEN p_weight_kg IS NULL OR v_total_units <= 0 THEN NULL
        ELSE ROUND((p_weight_kg * v_qty::numeric) / v_total_units::numeric, 3)
      END;

      v_line_description := CASE
        WHEN v_price IS NULL THEN FORMAT('%sx %s', v_qty, v_name)
        ELSE FORMAT('%sx %s (%s)', v_qty, v_name, v_price)
      END;

      INSERT INTO public.user_inventory (
        user_id, order_id, name, products_description, items_count, received_at,
        weight_kg, photo_url, video_url, notes, status
      )
      VALUES (
        p_user_id,
        p_order_id,
        v_name,
        v_line_description,
        v_qty,
        NOW(),
        v_weight_share,
        NULLIF(trim(p_photo_url), ''),
        NULLIF(trim(p_video_url), ''),
        NULL,
        'stored'
      )
      RETURNING * INTO v_pkg;

      IF v_inserted_count = 0 THEN
        v_first_pkg := v_pkg;
      END IF;
      v_inserted_count := v_inserted_count + 1;
    END LOOP;
  END IF;

  -- Legacy fallback: keep single aggregated inventory row.
  IF v_inserted_count = 0 THEN
    IF p_products IS NOT NULL AND jsonb_typeof(p_products) = 'array' AND jsonb_array_length(p_products) > 0 THEN
      v_legacy_description := (
        SELECT string_agg(
          COALESCE((item->>'quantity')::text, '1') || 'x ' || COALESCE((item->>'name')::text, 'Produto'),
          '; '
        )
        FROM jsonb_array_elements(p_products) AS item
      );
      v_legacy_items_count := (
        SELECT COALESCE(sum(COALESCE((item->>'quantity')::int, 1)), 0)
        FROM jsonb_array_elements(p_products) AS item
      );
    ELSE
      v_legacy_description := p_products_description;
      v_legacy_items_count := p_items_count;
    END IF;

    INSERT INTO public.user_inventory (
      user_id, order_id, name, products_description, items_count, received_at,
      weight_kg, photo_url, video_url, notes, status
    )
    VALUES (
      p_user_id,
      p_order_id,
      COALESCE(NULLIF(trim(LEFT(v_legacy_description, 100)), ''), 'Pacote recebido'),
      NULLIF(trim(v_legacy_description), ''),
      COALESCE(v_legacy_items_count, p_items_count),
      NOW(),
      p_weight_kg,
      NULLIF(trim(p_photo_url), ''),
      NULLIF(trim(p_video_url), ''),
      NULL,
      'stored'
    )
    RETURNING * INTO v_first_pkg;
  END IF;

  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'completed'
    WHERE id = p_order_id;
  END IF;

  RETURN to_jsonb(v_first_pkg);
END;
$$;

-- Keep admin shipping panel payload aligned with split inventory rows.
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
            'products_description', ui.products_description
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
      ui.items_count, ui.products_description,
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

-- Best-effort backfill: split legacy aggregated rows only when parsing is reliable.
DO $$
DECLARE
  v_inv public.user_inventory%ROWTYPE;
  v_part text;
  v_match text[];
  v_name text;
  v_qty integer;
  v_total_units integer;
  v_parsed_count integer;
  v_parsed_ok boolean;
  v_weight_share numeric;
BEGIN
  FOR v_inv IN
    SELECT ui.*
    FROM public.user_inventory ui
    WHERE COALESCE(ui.items_count, 0) > 1
      AND NULLIF(trim(ui.products_description), '') IS NOT NULL
      AND ui.status IN ('stored', 'ready_for_shipment')
      AND NOT EXISTS (
        SELECT 1
        FROM public.shipment_items si
        WHERE si.inventory_id = ui.id
      )
  LOOP
    v_total_units := 0;
    v_parsed_count := 0;
    v_parsed_ok := true;

    FOR v_part IN
      SELECT trim(x)
      FROM unnest(regexp_split_to_array(v_inv.products_description, '\s*;\s*')) AS x
    LOOP
      IF v_part = '' THEN
        CONTINUE;
      END IF;
      v_match := regexp_match(v_part, '^\s*([0-9]+)\s*x\s+(.+)\s*$');
      IF v_match IS NULL THEN
        v_parsed_ok := false;
        EXIT;
      END IF;
      v_qty := GREATEST(1, COALESCE(v_match[1]::int, 1));
      v_total_units := v_total_units + v_qty;
      v_parsed_count := v_parsed_count + 1;
    END LOOP;

    IF NOT v_parsed_ok OR v_parsed_count = 0 OR v_total_units <= 0 THEN
      UPDATE public.user_inventory
      SET notes = CASE
        WHEN COALESCE(notes, '') ILIKE '%split-review-required%' THEN notes
        ELSE trim(concat_ws(E'\n', NULLIF(notes, ''), 'split-review-required'))
      END
      WHERE id = v_inv.id;
      CONTINUE;
    END IF;

    FOR v_part IN
      SELECT trim(x)
      FROM unnest(regexp_split_to_array(v_inv.products_description, '\s*;\s*')) AS x
    LOOP
      IF v_part = '' THEN
        CONTINUE;
      END IF;

      v_match := regexp_match(v_part, '^\s*([0-9]+)\s*x\s+(.+)\s*$');
      IF v_match IS NULL THEN
        CONTINUE;
      END IF;

      v_qty := GREATEST(1, COALESCE(v_match[1]::int, 1));
      v_name := trim(v_match[2]);
      IF v_name = '' THEN
        v_name := COALESCE(NULLIF(trim(v_inv.name), ''), 'Produto');
      END IF;

      v_weight_share := CASE
        WHEN v_inv.weight_kg IS NULL THEN NULL
        ELSE ROUND((v_inv.weight_kg * v_qty::numeric) / v_total_units::numeric, 3)
      END;

      INSERT INTO public.user_inventory (
        user_id, order_id, product_id, name, products_description, items_count, received_at,
        weight_kg, photo_url, video_url, notes, status, created_at, updated_at
      )
      VALUES (
        v_inv.user_id,
        v_inv.order_id,
        v_inv.product_id,
        v_name,
        format('%sx %s', v_qty, v_name),
        v_qty,
        COALESCE(v_inv.received_at, NOW()),
        v_weight_share,
        v_inv.photo_url,
        v_inv.video_url,
        trim(concat_ws(E'\n', NULLIF(v_inv.notes, ''), format('split-from:%s', v_inv.id))),
        v_inv.status,
        COALESCE(v_inv.created_at, NOW()),
        NOW()
      );
    END LOOP;

    DELETE FROM public.user_inventory
    WHERE id = v_inv.id;
  END LOOP;
END $$;
