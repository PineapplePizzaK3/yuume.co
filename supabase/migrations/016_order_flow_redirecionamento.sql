-- Fluxo de redirecionamento: status + serviços extras + inventário do usuário
-- Status: created → awaiting_arrival → item_received → stored → ready_for_shipment → awaiting_payment → shipped → completed
-- REQUER: tabela public.orders (migration 001_initial_schema.sql)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    RAISE EXCEPTION 'Migration 016 requires table public.orders. Run 001_initial_schema.sql (and any earlier migrations) first.';
  END IF;
END $$;

-- Migrar status antigos para os novos
UPDATE public.orders SET status = 'created' WHERE status IN ('pending', 'requested');
UPDATE public.orders SET status = 'awaiting_arrival' WHERE status = 'order_paid';
UPDATE public.orders SET status = 'item_received' WHERE status = 'received';
UPDATE public.orders SET status = 'stored' WHERE status = 'consolidated';
-- paid, awaiting_payment, shipped permanecem; completed pode ser usado pelo admin ao finalizar

-- Coluna para serviços extras (fotos, vídeo) quando status = item_received
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS extra_services JSONB DEFAULT '{}';
COMMENT ON COLUMN public.orders.extra_services IS 'Ex.: {"photos": true, "video": true} ou URLs quando disponíveis';

-- Inventário do usuário: itens recebidos que passam a ser do usuário (após item recebido confirmado)
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  notes TEXT,
  weight_kg DECIMAL(10,3),
  photo_url TEXT,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'stored' CHECK (status IN ('stored', 'ready_for_shipment', 'shipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory" ON user_inventory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own inventory" ON user_inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin pode inserir/atualizar inventário (quando confirma item recebido)
CREATE POLICY "Admins can manage all inventory" ON user_inventory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_order_id ON user_inventory(order_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_status ON user_inventory(status);

-- RPC: admin atualiza status do pedido (novos status)
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_valid text[] := ARRAY['created','awaiting_arrival','item_received','stored','ready_for_shipment','awaiting_payment','paid','shipped','completed'];
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

-- RPC: admin edita pedido (inclui extra_services e novos status)
CREATE OR REPLACE FUNCTION public.admin_update_order(
  p_order_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_status text;
  v_valid text[] := ARRAY['created','awaiting_arrival','item_received','stored','ready_for_shipment','awaiting_payment','paid','shipped','completed'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_status := p_payload->>'status';
  IF v_status IS NOT NULL AND NOT (v_status = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  IF p_payload ? 'shipping_cost' THEN
    IF (p_payload->>'shipping_cost') IS NOT NULL AND (p_payload->>'shipping_cost')::numeric < 0 THEN
      RAISE EXCEPTION 'Valor do frete inválido';
    END IF;
  END IF;

  WITH updated AS (
    UPDATE public.orders
    SET
      message = CASE
        WHEN p_payload ? 'message' THEN NULLIF(trim(COALESCE(p_payload->>'message', '')), '')
        ELSE message
      END,
      service_id = CASE
        WHEN p_payload ? 'service_id' THEN (p_payload->>'service_id')::uuid
        ELSE service_id
      END,
      status = CASE
        WHEN p_payload ? 'status' THEN p_payload->>'status'
        ELSE status
      END,
      shipping_cost = CASE
        WHEN p_payload ? 'shipping_cost' THEN (p_payload->>'shipping_cost')::numeric
        ELSE shipping_cost
      END,
      shipping_currency = CASE
        WHEN p_payload ? 'shipping_currency' THEN COALESCE(NULLIF(trim(p_payload->>'shipping_currency'), ''), 'JPY')
        ELSE shipping_currency
      END,
      extra_services = CASE
        WHEN p_payload ? 'extra_services' THEN COALESCE((p_payload->'extra_services')::jsonb, '{}'::jsonb)
        ELSE extra_services
      END
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

-- RPC: usuário solicita serviços extras (fotos/vídeo) no pedido em status item_received
CREATE OR REPLACE FUNCTION public.request_order_extra_services(p_order_id uuid, p_extra_services jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF v_order.status <> 'item_received' THEN
    RAISE EXCEPTION 'Serviços extras só estão disponíveis quando o item foi recebido';
  END IF;
  UPDATE public.orders
  SET extra_services = COALESCE(extra_services, '{}'::jsonb) || COALESCE(p_extra_services, '{}'::jsonb)
  WHERE id = p_order_id
  RETURNING * INTO v_order;
  SELECT to_jsonb(v_order) INTO v_result;
  RETURN v_result;
END;
$$;

-- RPC: adicionar item ao inventário do usuário (admin, ao confirmar item recebido)
CREATE OR REPLACE FUNCTION public.admin_add_inventory_from_order(
  p_order_id uuid,
  p_name text,
  p_notes text DEFAULT NULL,
  p_weight_kg numeric DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_inv RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  INSERT INTO public.user_inventory (user_id, order_id, name, notes, weight_kg, photo_url, video_url, status)
  VALUES (
    v_order.user_id,
    p_order_id,
    COALESCE(NULLIF(trim(p_name), ''), 'Item do pedido ' || left(p_order_id::text, 8)),
    NULLIF(trim(p_notes), ''),
    p_weight_kg,
    NULLIF(trim(p_photo_url), ''),
    NULLIF(trim(p_video_url), ''),
    'stored'
  )
  RETURNING * INTO v_inv;
  RETURN to_jsonb(v_inv);
END;
$$;

-- Tabela de envio/consolidação: usuário seleciona itens do inventário e solicita envio
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'awaiting_payment', 'paid', 'shipped', 'completed')),
  shipping_cost DECIMAL(12,2),
  shipping_currency TEXT DEFAULT 'JPY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES user_inventory(id) ON DELETE CASCADE,
  UNIQUE(shipment_id, inventory_id)
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shipments" ON shipments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own shipments" ON shipments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage shipments" ON shipments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view own shipment items" ON shipment_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM shipments s WHERE s.id = shipment_items.shipment_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can insert own shipment items" ON shipment_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM shipments s WHERE s.id = shipment_items.shipment_id AND s.user_id = auth.uid())
);
CREATE POLICY "Admins can manage shipment items" ON shipment_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_inventory_id ON shipment_items(inventory_id);
