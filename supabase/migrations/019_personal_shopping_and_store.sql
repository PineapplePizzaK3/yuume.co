-- Personal Shopping + Loja Virtual
-- Personal Shopping: user envia pedido com imagens → admin orça → user paga → admin compra → pacotes vão pro inventário
-- Loja: carrinho → checkout (envio imediato?) → se não: pago → vai pro inventário | se sim: pago produtos → admin define frete → paga frete → enviamos

-- Orders: campos para Personal Shopping e Loja
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quote_amount DECIMAL(12,2);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quote_currency TEXT DEFAULT 'BRL';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_source TEXT DEFAULT 'service' CHECK (order_source IN ('service', 'store'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ship_immediately BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2); -- valor produtos (loja)
COMMENT ON COLUMN public.orders.quote_amount IS 'Orçamento (Personal Shopping)';
COMMENT ON COLUMN public.orders.attachment_urls IS 'URLs de imagens anexadas ao pedido';
COMMENT ON COLUMN public.orders.order_source IS 'service=Redirecionamento/Personal Shopping; store=Loja';
COMMENT ON COLUMN public.orders.ship_immediately IS 'Loja: enviar imediatamente após pagar produtos';
COMMENT ON COLUMN public.orders.total_amount IS 'Loja: total dos produtos';

-- Status para Personal Shopping
-- awaiting_quote: user enviou, admin precisa orçar
-- quoted: admin orçou, user precisa pagar
UPDATE public.orders SET status = 'pending_approval'
WHERE status = 'created' AND (order_source = 'service' OR order_source IS NULL);

-- Cart: carrinho da loja
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart" ON cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cart" ON cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cart" ON cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cart" ON cart_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- Order items: itens do pedido (loja)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_purchase DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "Admins can manage order items" ON order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can insert own order items" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- User inventory: link opcional ao produto (loja)
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Atualizar admin_update_order para quote e novos campos
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
  v_valid text[] := ARRAY['pending_approval','approved','rejected','awaiting_quote','quoted','awaiting_arrival','item_received','stored','ready_for_shipment','awaiting_payment','paid','shipped','completed','products_paid'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_status := p_payload->>'status';
  IF v_status IS NOT NULL AND NOT (v_status = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Status inválido: %', v_status;
  END IF;

  WITH updated AS (
    UPDATE public.orders
    SET
      message = CASE WHEN p_payload ? 'message' THEN NULLIF(trim(COALESCE(p_payload->>'message', '')), '') ELSE message END,
      service_id = CASE WHEN p_payload ? 'service_id' THEN (p_payload->>'service_id')::uuid ELSE service_id END,
      status = CASE WHEN p_payload ? 'status' THEN p_payload->>'status' ELSE status END,
      shipping_cost = CASE WHEN p_payload ? 'shipping_cost' THEN (p_payload->>'shipping_cost')::numeric ELSE shipping_cost END,
      shipping_currency = CASE WHEN p_payload ? 'shipping_currency' THEN COALESCE(NULLIF(trim(p_payload->>'shipping_currency'), ''), 'JPY') ELSE shipping_currency END,
      extra_services = CASE WHEN p_payload ? 'extra_services' THEN COALESCE((p_payload->'extra_services')::jsonb, '{}'::jsonb) ELSE extra_services END,
      quote_amount = CASE WHEN p_payload ? 'quote_amount' THEN (p_payload->>'quote_amount')::numeric ELSE quote_amount END,
      quote_currency = CASE WHEN p_payload ? 'quote_currency' THEN COALESCE(NULLIF(trim(p_payload->>'quote_currency'), ''), 'BRL') ELSE quote_currency END
    WHERE id = p_order_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  RETURN v_result;
END;
$$;

-- RPC: admin define orçamento (Personal Shopping) e marca como aguardando pagamento
CREATE OR REPLACE FUNCTION public.admin_set_quote(
  p_order_id uuid,
  p_quote_amount numeric,
  p_currency text DEFAULT 'BRL'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_quote_amount IS NULL OR p_quote_amount < 0 THEN
    RAISE EXCEPTION 'Valor do orçamento inválido';
  END IF;
  UPDATE public.orders
  SET quote_amount = p_quote_amount,
      quote_currency = COALESCE(NULLIF(trim(p_currency), ''), 'BRL'),
      status = 'awaiting_payment'
  WHERE id = p_order_id
  RETURNING to_jsonb(orders.*) INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN v_result;
END;
$$;

-- RPC: criar pedido da loja (a partir do carrinho)
CREATE OR REPLACE FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item RECORD;
  v_total numeric := 0;
  v_order jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  -- Inserir pedido
  INSERT INTO public.orders (user_id, created_by, order_source, ship_immediately, status)
  VALUES (
    p_user_id,
    p_user_id,
    'store',
    p_ship_immediately,
    CASE WHEN p_ship_immediately THEN 'awaiting_payment' ELSE 'awaiting_payment' END
  )
  RETURNING id INTO v_order_id;

  -- Inserir order_items a partir do carrinho e calcular total
  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.price
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    WHERE ci.user_id = p_user_id
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.price);
    v_total := v_total + (v_item.price * v_item.quantity);
  END LOOP;

  IF v_total <= 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id;
    RAISE EXCEPTION 'Carrinho vazio ou inválido';
  END IF;

  UPDATE public.orders SET total_amount = v_total WHERE id = v_order_id;

  -- Limpar carrinho
  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  SELECT to_jsonb(o) INTO v_order FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_order;
END;
$$;

-- RPC: após pagamento loja (ship_immediately=false): adiciona produtos ao inventário
CREATE OR REPLACE FUNCTION public.store_order_add_to_inventory(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_item RECORD; v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.order_source <> 'store' OR v_order.ship_immediately THEN
    RAISE EXCEPTION 'Pedido inválido para esta operação';
  END IF;
  IF v_order.status <> 'paid' THEN
    RAISE EXCEPTION 'Pedido deve estar pago';
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.name
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    INSERT INTO public.user_inventory (user_id, order_id, product_id, name, status)
    VALUES (
      v_order.user_id,
      p_order_id,
      v_item.product_id,
      v_item.name || ' (x' || v_item.quantity || ')',
      'stored'
    );
  END LOOP;
END;
$$;

-- RPC wallet_pay_order: suportar quote_amount (Personal Shopping) e total_amount (Loja)
CREATE OR REPLACE FUNCTION public.wallet_pay_order(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_amount NUMERIC;
  v_currency TEXT;
  v_type TEXT;
  v_desc TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Pedido não está aguardando pagamento';
  END IF;

  IF v_order.order_source = 'store' AND v_order.total_amount IS NOT NULL AND v_order.total_amount > 0 THEN
    v_amount := v_order.total_amount;
    v_currency := 'BRL';
    v_type := 'loja';
    v_desc := 'Loja - Pedido ' || LEFT(p_order_id::text, 8);
  ELSIF v_order.quote_amount IS NOT NULL AND v_order.quote_amount > 0 THEN
    v_amount := v_order.quote_amount;
    v_currency := COALESCE(UPPER(TRIM(v_order.quote_currency)), 'BRL');
    v_type := 'order_service';
    v_desc := 'Personal Shopping - Pedido ' || LEFT(p_order_id::text, 8);
  ELSE
    v_amount := v_order.shipping_cost;
    v_currency := COALESCE(UPPER(TRIM(v_order.shipping_currency)), 'JPY');
    v_type := 'order_shipping';
    v_desc := 'Frete - Pedido ' || LEFT(p_order_id::text, 8);
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Valor não definido para este pedido';
  END IF;
  IF v_currency <> 'BRL' THEN
    RAISE EXCEPTION 'Pagamento com carteira disponível apenas em BRL';
  END IF;

  PERFORM public.wallet_debit(p_user_id, v_amount, v_type, v_desc, 'order', p_order_id);

  UPDATE orders SET status = 'paid' WHERE id = p_order_id;

  INSERT INTO payments (order_id, stripe_payment_id, status, amount)
  VALUES (p_order_id, 'wallet', 'completed', v_amount);

  IF v_order.order_source = 'store' AND NOT v_order.ship_immediately THEN
    PERFORM public.store_order_add_to_inventory(p_order_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- Atualizar admin_update_order_status para novos status
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_valid text[] := ARRAY['pending_approval','approved','rejected','awaiting_quote','quoted','awaiting_arrival','item_received','stored','ready_for_shipment','awaiting_payment','paid','shipped','completed','products_paid'];
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
  IF v_result IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN v_result;
END;
$$;

-- Storage: criar policy para usuários enviarem imagens em product-images/orders/{user_id}/
-- Execute manualmente no Supabase se o upload falhar:
-- CREATE POLICY "Users can upload order attachments" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id='product-images' AND (storage.foldername(name))[1]='orders' AND (storage.foldername(name))[2]=auth.uid()::text);
