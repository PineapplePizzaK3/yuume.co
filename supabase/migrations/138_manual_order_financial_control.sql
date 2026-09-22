-- Controle financeiro gerencial para pedidos finalizados cadastrados manualmente.
-- Escopo desta migration:
-- 1) tabelas isoladas (nao reutiliza orders)
-- 2) RLS admin only
-- 3) RPCs para CRUD + resumo consolidado em JPY

CREATE TABLE IF NOT EXISTS public.manual_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  sale_date date NOT NULL,
  customer_name text,
  currency text NOT NULL CHECK (currency IN ('JPY', 'USD', 'BRL')),
  exchange_rate_to_jpy numeric(14,6) NOT NULL DEFAULT 1 CHECK (exchange_rate_to_jpy > 0),
  shipping_charged_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (shipping_charged_amount >= 0),
  discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  refund_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_orders_reference_not_blank CHECK (length(trim(reference)) > 0)
);

CREATE TABLE IF NOT EXISTS public.manual_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_order_id uuid NOT NULL REFERENCES public.manual_orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_sale_amount numeric(14,2) NOT NULL CHECK (unit_sale_amount >= 0),
  unit_cost_amount numeric(14,2) NOT NULL CHECK (unit_cost_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manual_order_items_product_name_not_blank CHECK (length(trim(product_name)) > 0)
);

CREATE TABLE IF NOT EXISTS public.financial_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency IN ('JPY', 'USD', 'BRL')),
  exchange_rate_to_jpy numeric(14,6) NOT NULL DEFAULT 1 CHECK (exchange_rate_to_jpy > 0),
  expense_kind text NOT NULL DEFAULT 'general' CHECK (expense_kind IN ('general', 'shipping', 'order_related')),
  manual_order_id uuid REFERENCES public.manual_orders(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_expenses_category_not_blank CHECK (length(trim(category)) > 0),
  CONSTRAINT financial_expenses_description_not_blank CHECK (length(trim(description)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_manual_orders_sale_date ON public.manual_orders(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_manual_orders_reference ON public.manual_orders(reference);
CREATE INDEX IF NOT EXISTS idx_manual_order_items_order_id ON public.manual_order_items(manual_order_id);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_date ON public.financial_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_category ON public.financial_expenses(category);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_manual_order_id ON public.financial_expenses(manual_order_id);

ALTER TABLE public.manual_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage manual orders" ON public.manual_orders;
CREATE POLICY "Admins can manage manual orders"
  ON public.manual_orders
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage manual order items" ON public.manual_order_items;
CREATE POLICY "Admins can manage manual order items"
  ON public.manual_order_items
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage financial expenses" ON public.financial_expenses;
CREATE POLICY "Admins can manage financial expenses"
  ON public.financial_expenses
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE VIEW public.manual_order_financials AS
SELECT
  mo.id,
  mo.reference,
  mo.sale_date,
  mo.customer_name,
  mo.currency,
  mo.exchange_rate_to_jpy,
  mo.shipping_charged_amount,
  mo.discount_amount,
  mo.refund_amount,
  mo.notes,
  mo.created_by,
  mo.created_at,
  mo.updated_at,
  COALESCE(items.items_count, 0)::int AS items_count,
  COALESCE(items.units_total, 0)::numeric AS units_total,
  COALESCE(items.items_sale_amount, 0)::numeric(14,2) AS items_sale_amount,
  COALESCE(items.items_cost_amount, 0)::numeric(14,2) AS items_cost_amount,
  ROUND(COALESCE(items.items_sale_amount, 0) * mo.exchange_rate_to_jpy, 2) AS items_sale_jpy,
  ROUND(COALESCE(items.items_cost_amount, 0) * mo.exchange_rate_to_jpy, 2) AS items_cost_jpy,
  ROUND(mo.shipping_charged_amount * mo.exchange_rate_to_jpy, 2) AS shipping_charged_jpy,
  ROUND(mo.discount_amount * mo.exchange_rate_to_jpy, 2) AS discount_jpy,
  ROUND(mo.refund_amount * mo.exchange_rate_to_jpy, 2) AS refund_jpy,
  ROUND((COALESCE(items.items_sale_amount, 0) + mo.shipping_charged_amount) * mo.exchange_rate_to_jpy, 2) AS gross_revenue_jpy,
  ROUND((COALESCE(items.items_sale_amount, 0) + mo.shipping_charged_amount - mo.discount_amount - mo.refund_amount) * mo.exchange_rate_to_jpy, 2) AS net_revenue_jpy,
  COALESCE(exp.shipping_paid_jpy, 0)::numeric(14,2) AS shipping_paid_jpy,
  COALESCE(exp.order_expenses_jpy, 0)::numeric(14,2) AS order_expenses_jpy,
  ROUND(
    ((COALESCE(items.items_sale_amount, 0) + mo.shipping_charged_amount - mo.discount_amount - mo.refund_amount) * mo.exchange_rate_to_jpy)
    - (COALESCE(items.items_cost_amount, 0) * mo.exchange_rate_to_jpy)
    - COALESCE(exp.shipping_paid_jpy, 0),
    2
  ) AS gross_profit_jpy,
  ROUND(
    (
      ((COALESCE(items.items_sale_amount, 0) + mo.shipping_charged_amount - mo.discount_amount - mo.refund_amount) * mo.exchange_rate_to_jpy)
      - (COALESCE(items.items_cost_amount, 0) * mo.exchange_rate_to_jpy)
      - COALESCE(exp.shipping_paid_jpy, 0)
    ) - COALESCE(exp.order_expenses_jpy, 0),
    2
  ) AS net_profit_jpy
FROM public.manual_orders mo
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS items_count,
    COALESCE(SUM(oi.quantity), 0) AS units_total,
    COALESCE(SUM(oi.quantity * oi.unit_sale_amount), 0) AS items_sale_amount,
    COALESCE(SUM(oi.quantity * oi.unit_cost_amount), 0) AS items_cost_amount
  FROM public.manual_order_items oi
  WHERE oi.manual_order_id = mo.id
) items ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COALESCE(SUM(CASE WHEN fe.expense_kind = 'shipping' THEN fe.amount * fe.exchange_rate_to_jpy ELSE 0 END), 0) AS shipping_paid_jpy,
    COALESCE(SUM(CASE WHEN fe.expense_kind = 'order_related' THEN fe.amount * fe.exchange_rate_to_jpy ELSE 0 END), 0) AS order_expenses_jpy
  FROM public.financial_expenses fe
  WHERE fe.manual_order_id = mo.id
) exp ON TRUE;

CREATE OR REPLACE FUNCTION public.admin_financial_list_manual_orders(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 300);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_total bigint := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*)
    INTO v_total
  FROM public.manual_order_financials mo
  WHERE (p_from IS NULL OR mo.sale_date >= p_from)
    AND (p_to IS NULL OR mo.sale_date <= p_to)
    AND (
      v_search IS NULL
      OR mo.reference ILIKE ('%' || v_search || '%')
      OR COALESCE(mo.customer_name, '') ILIKE ('%' || v_search || '%')
      OR COALESCE(mo.notes, '') ILIKE ('%' || v_search || '%')
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT *
    FROM public.manual_order_financials mo
    WHERE (p_from IS NULL OR mo.sale_date >= p_from)
      AND (p_to IS NULL OR mo.sale_date <= p_to)
      AND (
        v_search IS NULL
        OR mo.reference ILIKE ('%' || v_search || '%')
        OR COALESCE(mo.customer_name, '') ILIKE ('%' || v_search || '%')
        OR COALESCE(mo.notes, '') ILIKE ('%' || v_search || '%')
      )
    ORDER BY mo.sale_date DESC, mo.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_get_manual_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT
    to_jsonb(mo)
    || jsonb_build_object(
      'items',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', oi.id,
              'product_name', oi.product_name,
              'quantity', oi.quantity,
              'unit_sale_amount', oi.unit_sale_amount,
              'unit_cost_amount', oi.unit_cost_amount,
              'created_at', oi.created_at,
              'updated_at', oi.updated_at
            )
            ORDER BY oi.created_at ASC, oi.id ASC
          )
          FROM public.manual_order_items oi
          WHERE oi.manual_order_id = mo.id
        ),
        '[]'::jsonb
      ),
      'expenses',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', fe.id,
              'expense_date', fe.expense_date,
              'category', fe.category,
              'description', fe.description,
              'amount', fe.amount,
              'currency', fe.currency,
              'exchange_rate_to_jpy', fe.exchange_rate_to_jpy,
              'expense_kind', fe.expense_kind,
              'amount_jpy', ROUND(fe.amount * fe.exchange_rate_to_jpy, 2),
              'notes', fe.notes,
              'created_at', fe.created_at,
              'updated_at', fe.updated_at
            )
            ORDER BY fe.expense_date DESC, fe.created_at DESC
          )
          FROM public.financial_expenses fe
          WHERE fe.manual_order_id = mo.id
        ),
        '[]'::jsonb
      )
    )
  INTO v_order
  FROM public.manual_order_financials mo
  WHERE mo.id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido manual nao encontrado';
  END IF;

  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_upsert_manual_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid := NULLIF(trim(COALESCE(p_payload->>'id', '')), '')::uuid;
  v_saved_id uuid;
  v_reference text := trim(COALESCE(p_payload->>'reference', ''));
  v_sale_date date := COALESCE(NULLIF(trim(COALESCE(p_payload->>'sale_date', '')), '')::date, CURRENT_DATE);
  v_customer_name text := NULLIF(trim(COALESCE(p_payload->>'customer_name', '')), '');
  v_currency text := UPPER(trim(COALESCE(p_payload->>'currency', 'JPY')));
  v_rate numeric := COALESCE(NULLIF(trim(COALESCE(p_payload->>'exchange_rate_to_jpy', '')), '')::numeric, 1);
  v_shipping numeric := COALESCE(NULLIF(trim(COALESCE(p_payload->>'shipping_charged_amount', '')), '')::numeric, 0);
  v_discount numeric := COALESCE(NULLIF(trim(COALESCE(p_payload->>'discount_amount', '')), '')::numeric, 0);
  v_refund numeric := COALESCE(NULLIF(trim(COALESCE(p_payload->>'refund_amount', '')), '')::numeric, 0);
  v_notes text := NULLIF(trim(COALESCE(p_payload->>'notes', '')), '');
  v_items jsonb := COALESCE(p_payload->'items', '[]'::jsonb);
  v_item jsonb;
  v_item_count integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_reference = '' THEN
    RAISE EXCEPTION 'Referencia e obrigatoria';
  END IF;
  IF v_currency NOT IN ('JPY', 'USD', 'BRL') THEN
    RAISE EXCEPTION 'Moeda invalida';
  END IF;
  IF v_rate <= 0 THEN
    RAISE EXCEPTION 'Taxa para JPY invalida';
  END IF;
  IF v_shipping < 0 OR v_discount < 0 OR v_refund < 0 THEN
    RAISE EXCEPTION 'Valores de frete/desconto/reembolso devem ser >= 0';
  END IF;
  IF jsonb_typeof(v_items) <> 'array' THEN
    RAISE EXCEPTION 'Lista de itens invalida';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) AS t(value)
  LOOP
    v_item_count := v_item_count + 1;
    IF trim(COALESCE(v_item->>'product_name', '')) = '' THEN
      RAISE EXCEPTION 'Nome do item e obrigatorio';
    END IF;
    IF COALESCE(NULLIF(trim(COALESCE(v_item->>'quantity', '')), '')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantidade do item deve ser > 0';
    END IF;
    IF COALESCE(NULLIF(trim(COALESCE(v_item->>'unit_sale_amount', '')), '')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Preco de venda do item invalido';
    END IF;
    IF COALESCE(NULLIF(trim(COALESCE(v_item->>'unit_cost_amount', '')), '')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Custo do item invalido';
    END IF;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Pedido manual precisa de pelo menos 1 item';
  END IF;

  IF v_order_id IS NULL THEN
    INSERT INTO public.manual_orders (
      reference,
      sale_date,
      customer_name,
      currency,
      exchange_rate_to_jpy,
      shipping_charged_amount,
      discount_amount,
      refund_amount,
      notes,
      created_by
    )
    VALUES (
      v_reference,
      v_sale_date,
      v_customer_name,
      v_currency,
      v_rate,
      v_shipping,
      v_discount,
      v_refund,
      v_notes,
      auth.uid()
    )
    RETURNING id INTO v_saved_id;
  ELSE
    UPDATE public.manual_orders
    SET
      reference = v_reference,
      sale_date = v_sale_date,
      customer_name = v_customer_name,
      currency = v_currency,
      exchange_rate_to_jpy = v_rate,
      shipping_charged_amount = v_shipping,
      discount_amount = v_discount,
      refund_amount = v_refund,
      notes = v_notes,
      updated_at = now()
    WHERE id = v_order_id
    RETURNING id INTO v_saved_id;

    IF v_saved_id IS NULL THEN
      RAISE EXCEPTION 'Pedido manual nao encontrado';
    END IF;
  END IF;

  DELETE FROM public.manual_order_items WHERE manual_order_id = v_saved_id;

  INSERT INTO public.manual_order_items (
    manual_order_id,
    product_name,
    quantity,
    unit_sale_amount,
    unit_cost_amount
  )
  SELECT
    v_saved_id,
    trim(COALESCE(item.value->>'product_name', '')),
    (item.value->>'quantity')::numeric,
    (item.value->>'unit_sale_amount')::numeric,
    (item.value->>'unit_cost_amount')::numeric
  FROM jsonb_array_elements(v_items) AS item(value);

  RETURN public.admin_financial_get_manual_order(v_saved_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_delete_manual_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.manual_orders WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_list_expenses(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_manual_order_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_category text := NULLIF(trim(COALESCE(p_category, '')), '');
  v_total bigint := 0;
  v_rows jsonb := '[]'::jsonb;
  v_categories jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*)
    INTO v_total
  FROM public.financial_expenses fe
  WHERE (p_from IS NULL OR fe.expense_date >= p_from)
    AND (p_to IS NULL OR fe.expense_date <= p_to)
    AND (v_category IS NULL OR fe.category = v_category)
    AND (p_manual_order_id IS NULL OR fe.manual_order_id = p_manual_order_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      fe.*,
      ROUND(fe.amount * fe.exchange_rate_to_jpy, 2) AS amount_jpy,
      mo.reference AS manual_order_reference
    FROM public.financial_expenses fe
    LEFT JOIN public.manual_orders mo ON mo.id = fe.manual_order_id
    WHERE (p_from IS NULL OR fe.expense_date >= p_from)
      AND (p_to IS NULL OR fe.expense_date <= p_to)
      AND (v_category IS NULL OR fe.category = v_category)
      AND (p_manual_order_id IS NULL OR fe.manual_order_id = p_manual_order_id)
    ORDER BY fe.expense_date DESC, fe.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  SELECT COALESCE(jsonb_agg(x.category), '[]'::jsonb)
    INTO v_categories
  FROM (
    SELECT DISTINCT category
    FROM public.financial_expenses
    WHERE category IS NOT NULL AND trim(category) <> ''
    ORDER BY category
  ) x;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'categories', v_categories
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_upsert_expense(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expense_id uuid := NULLIF(trim(COALESCE(p_payload->>'id', '')), '')::uuid;
  v_date date := COALESCE(NULLIF(trim(COALESCE(p_payload->>'expense_date', '')), '')::date, CURRENT_DATE);
  v_category text := trim(COALESCE(p_payload->>'category', ''));
  v_description text := trim(COALESCE(p_payload->>'description', ''));
  v_amount numeric := COALESCE(NULLIF(trim(COALESCE(p_payload->>'amount', '')), '')::numeric, 0);
  v_currency text := UPPER(trim(COALESCE(p_payload->>'currency', 'JPY')));
  v_rate numeric := COALESCE(NULLIF(trim(COALESCE(p_payload->>'exchange_rate_to_jpy', '')), '')::numeric, 1);
  v_kind text := LOWER(trim(COALESCE(p_payload->>'expense_kind', 'general')));
  v_manual_order_id uuid := NULLIF(trim(COALESCE(p_payload->>'manual_order_id', '')), '')::uuid;
  v_notes text := NULLIF(trim(COALESCE(p_payload->>'notes', '')), '');
  v_saved_id uuid;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_category = '' THEN
    RAISE EXCEPTION 'Categoria e obrigatoria';
  END IF;
  IF v_description = '' THEN
    RAISE EXCEPTION 'Descricao e obrigatoria';
  END IF;
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Valor de despesa invalido';
  END IF;
  IF v_currency NOT IN ('JPY', 'USD', 'BRL') THEN
    RAISE EXCEPTION 'Moeda invalida';
  END IF;
  IF v_rate <= 0 THEN
    RAISE EXCEPTION 'Taxa para JPY invalida';
  END IF;
  IF v_kind NOT IN ('general', 'shipping', 'order_related') THEN
    RAISE EXCEPTION 'Tipo de despesa invalido';
  END IF;
  IF v_kind <> 'general' AND v_manual_order_id IS NULL THEN
    RAISE EXCEPTION 'Despesa vinculada ao pedido precisa de manual_order_id';
  END IF;

  IF v_expense_id IS NULL THEN
    INSERT INTO public.financial_expenses (
      expense_date,
      category,
      description,
      amount,
      currency,
      exchange_rate_to_jpy,
      expense_kind,
      manual_order_id,
      notes,
      created_by
    )
    VALUES (
      v_date,
      v_category,
      v_description,
      v_amount,
      v_currency,
      v_rate,
      v_kind,
      v_manual_order_id,
      v_notes,
      auth.uid()
    )
    RETURNING id INTO v_saved_id;
  ELSE
    UPDATE public.financial_expenses
    SET
      expense_date = v_date,
      category = v_category,
      description = v_description,
      amount = v_amount,
      currency = v_currency,
      exchange_rate_to_jpy = v_rate,
      expense_kind = v_kind,
      manual_order_id = v_manual_order_id,
      notes = v_notes,
      updated_at = now()
    WHERE id = v_expense_id
    RETURNING id INTO v_saved_id;

    IF v_saved_id IS NULL THEN
      RAISE EXCEPTION 'Despesa nao encontrada';
    END IF;
  END IF;

  SELECT to_jsonb(fe) || jsonb_build_object(
    'amount_jpy', ROUND(fe.amount * fe.exchange_rate_to_jpy, 2)
  )
  INTO v_result
  FROM public.financial_expenses fe
  WHERE fe.id = v_saved_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_delete_expense(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.financial_expenses WHERE id = p_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_summary jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH filtered_orders AS (
    SELECT *
    FROM public.manual_order_financials mo
    WHERE (p_from IS NULL OR mo.sale_date >= p_from)
      AND (p_to IS NULL OR mo.sale_date <= p_to)
  ),
  filtered_expenses AS (
    SELECT
      fe.*,
      ROUND(fe.amount * fe.exchange_rate_to_jpy, 2) AS amount_jpy
    FROM public.financial_expenses fe
    WHERE (p_from IS NULL OR fe.expense_date >= p_from)
      AND (p_to IS NULL OR fe.expense_date <= p_to)
  ),
  general_expenses AS (
    SELECT *
    FROM filtered_expenses
    WHERE manual_order_id IS NULL OR expense_kind = 'general'
  ),
  kpi AS (
    SELECT
      COUNT(*)::int AS orders_count,
      COALESCE(SUM(units_total), 0)::numeric(14,3) AS units_total,
      COALESCE(SUM(gross_revenue_jpy), 0)::numeric(14,2) AS gross_revenue_jpy,
      COALESCE(SUM(net_revenue_jpy), 0)::numeric(14,2) AS net_revenue_jpy,
      COALESCE(SUM(items_cost_jpy), 0)::numeric(14,2) AS items_cost_jpy,
      COALESCE(SUM(shipping_paid_jpy), 0)::numeric(14,2) AS shipping_paid_jpy,
      COALESCE(SUM(order_expenses_jpy), 0)::numeric(14,2) AS order_expenses_jpy,
      COALESCE(SUM(gross_profit_jpy), 0)::numeric(14,2) AS gross_profit_jpy,
      COALESCE(SUM(net_profit_jpy), 0)::numeric(14,2) AS net_profit_jpy
    FROM filtered_orders
  ),
  general AS (
    SELECT COALESCE(SUM(amount_jpy), 0)::numeric(14,2) AS general_expenses_jpy
    FROM general_expenses
  ),
  monthly_orders AS (
    SELECT
      date_trunc('month', sale_date)::date AS month_ref,
      COUNT(*)::int AS orders_count,
      COALESCE(SUM(net_revenue_jpy), 0)::numeric(14,2) AS net_revenue_jpy,
      COALESCE(SUM(gross_profit_jpy), 0)::numeric(14,2) AS gross_profit_jpy,
      COALESCE(SUM(net_profit_jpy), 0)::numeric(14,2) AS net_profit_jpy
    FROM filtered_orders
    GROUP BY 1
  ),
  monthly_general_expenses AS (
    SELECT
      date_trunc('month', expense_date)::date AS month_ref,
      COALESCE(SUM(amount_jpy), 0)::numeric(14,2) AS general_expenses_jpy
    FROM general_expenses
    GROUP BY 1
  ),
  monthly_combined AS (
    SELECT
      COALESCE(mo.month_ref, mg.month_ref) AS month_ref,
      COALESCE(mo.orders_count, 0)::int AS orders_count,
      COALESCE(mo.net_revenue_jpy, 0)::numeric(14,2) AS net_revenue_jpy,
      COALESCE(mo.gross_profit_jpy, 0)::numeric(14,2) AS gross_profit_jpy,
      COALESCE(mo.net_profit_jpy, 0)::numeric(14,2) AS net_profit_jpy,
      COALESCE(mg.general_expenses_jpy, 0)::numeric(14,2) AS general_expenses_jpy,
      (COALESCE(mo.net_profit_jpy, 0) - COALESCE(mg.general_expenses_jpy, 0))::numeric(14,2) AS net_after_general_jpy
    FROM monthly_orders mo
    FULL OUTER JOIN monthly_general_expenses mg ON mg.month_ref = mo.month_ref
  ),
  expenses_by_category AS (
    SELECT
      category,
      COALESCE(SUM(amount_jpy), 0)::numeric(14,2) AS amount_jpy
    FROM filtered_expenses
    GROUP BY category
    ORDER BY amount_jpy DESC, category ASC
  )
  SELECT jsonb_build_object(
    'kpis',
    jsonb_build_object(
      'orders_count', k.orders_count,
      'units_total', k.units_total,
      'gross_revenue_jpy', k.gross_revenue_jpy,
      'net_revenue_jpy', k.net_revenue_jpy,
      'items_cost_jpy', k.items_cost_jpy,
      'shipping_paid_jpy', k.shipping_paid_jpy,
      'order_expenses_jpy', k.order_expenses_jpy,
      'general_expenses_jpy', g.general_expenses_jpy,
      'gross_profit_jpy', k.gross_profit_jpy,
      'net_profit_jpy', k.net_profit_jpy,
      'net_profit_after_general_jpy', (k.net_profit_jpy - g.general_expenses_jpy)::numeric(14,2),
      'ticket_medio_jpy', CASE WHEN k.orders_count > 0 THEN ROUND(k.net_revenue_jpy / k.orders_count, 2) ELSE 0 END,
      'margem_bruta_percent', CASE WHEN k.net_revenue_jpy > 0 THEN ROUND((k.gross_profit_jpy / k.net_revenue_jpy) * 100, 2) ELSE 0 END,
      'margem_liquida_percent', CASE WHEN k.net_revenue_jpy > 0 THEN ROUND(((k.net_profit_jpy - g.general_expenses_jpy) / k.net_revenue_jpy) * 100, 2) ELSE 0 END
    ),
    'monthly',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'month', to_char(m.month_ref, 'YYYY-MM'),
            'orders_count', m.orders_count,
            'net_revenue_jpy', m.net_revenue_jpy,
            'gross_profit_jpy', m.gross_profit_jpy,
            'net_profit_jpy', m.net_profit_jpy,
            'general_expenses_jpy', m.general_expenses_jpy,
            'net_after_general_jpy', m.net_after_general_jpy
          )
          ORDER BY m.month_ref ASC
        )
        FROM monthly_combined m
      ),
      '[]'::jsonb
    ),
    'expenses_by_category',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'category', e.category,
            'amount_jpy', e.amount_jpy
          )
          ORDER BY e.amount_jpy DESC, e.category ASC
        )
        FROM expenses_by_category e
      ),
      '[]'::jsonb
    )
  )
  INTO v_summary
  FROM kpi k
  CROSS JOIN general g;

  RETURN COALESCE(v_summary, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_financial_list_manual_orders(date, date, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_financial_get_manual_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_financial_upsert_manual_order(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_financial_delete_manual_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_financial_list_expenses(date, date, text, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_financial_upsert_expense(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_financial_delete_expense(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_financial_summary(date, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_financial_list_manual_orders(date, date, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_financial_get_manual_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_financial_upsert_manual_order(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_financial_delete_manual_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_financial_list_expenses(date, date, text, uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_financial_upsert_expense(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_financial_delete_expense(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_financial_summary(date, date) TO authenticated, service_role;
