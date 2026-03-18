-- Novo fluxo de pedidos: receber → consolidar → frete real → pagar → enviar
-- Executar após 009

-- Migrar status antigo 'pending' para 'requested'
UPDATE orders SET status = 'requested' WHERE status = 'pending';

-- Statuses do pedido:
-- requested: usuário solicitou produtos
-- received: produtos recebidos no armazém
-- consolidated: produtos consolidados, frete calculado
-- awaiting_payment: aguardando pagamento do frete pelo usuário
-- paid: frete pago
-- shipped: enviado ao cliente

-- Campos de frete no pedido
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_currency TEXT DEFAULT 'JPY';

-- Constraint para status válidos (opcional, ajuda na consistência)
-- Por simplicidade, usamos TEXT e validamos na aplicação

-- Policy para admin atualizar pedidos (status, shipping_cost)
CREATE POLICY "Admins can update orders" ON orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Policy para admin ver todos os pedidos
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- RPC: admin lista pedidos com dados do usuário (email, nome)
CREATE OR REPLACE FUNCTION public.admin_orders_with_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
      ORDER BY o.created_at DESC
    ) o
  );
END;
$$;

-- RPC: admin atualiza status do pedido
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_valid text[] := ARRAY['requested','received','consolidated','awaiting_payment','paid','shipped'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NOT (p_status = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  WITH updated AS (
    UPDATE public.orders SET status = p_status WHERE id = p_order_id RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  RETURN v_result;
END;
$$;

-- RPC: admin define frete e marca como aguardando pagamento
CREATE OR REPLACE FUNCTION public.admin_set_shipping_await_payment(p_order_id uuid, p_shipping_cost numeric, p_currency text DEFAULT 'JPY')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_shipping_cost IS NULL OR p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;
  WITH updated AS (
    UPDATE public.orders
    SET shipping_cost = p_shipping_cost, shipping_currency = COALESCE(NULLIF(trim(p_currency),''), 'JPY'), status = 'awaiting_payment'
    WHERE id = p_order_id RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  RETURN v_result;
END;
$$;
