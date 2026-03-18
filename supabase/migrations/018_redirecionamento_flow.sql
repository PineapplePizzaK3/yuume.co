-- Novo fluxo Redirecionamento:

-- RPC: admin lista usuários (para criar pedido/registrar pacote em nome de)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'name', p.name,
      'account_code', p.account_code
    ) ORDER BY p.name NULLS LAST, p.email), '[]'::jsonb)
    FROM public.profiles p
  );
END;
$$;

-- 1. User cria pedido (ou admin cria para user) → pending_approval
-- 2. Admin aprova → approved (aguardando pacotes)
-- 3. Admin registra pacotes recebidos na conta do user
-- 4. User seleciona pacotes, solicita envio → shipment
-- 5. Admin define invoice, serviços extras → user paga
-- 6. Enviado + rastreio

-- Orders: novo status flow
-- Migrar: created → pending_approval (pedido criado, aguardando aprovação)
UPDATE public.orders SET status = 'pending_approval'
WHERE status = 'created' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'status');

-- Adicionar coluna created_by (user_id de quem criou, para admin criar em nome do user)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.orders.created_by IS 'Quem criou o pedido (user ou admin). Se NULL, assume user_id.';

-- User_inventory (pacotes): campos adicionais
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS products_description TEXT;
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS storage_days INTEGER;
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
COMMENT ON COLUMN public.user_inventory.products_description IS 'Descrição dos produtos no pacote';
COMMENT ON COLUMN public.user_inventory.storage_days IS 'Tempo de armazenamento em dias';
COMMENT ON COLUMN public.user_inventory.received_at IS 'Data/hora em que o pacote foi recebido';

-- Shipments: rastreio e serviços extras
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS extra_services JSONB DEFAULT '{}';
COMMENT ON COLUMN public.shipments.tracking_code IS 'Código de rastreio da caixa';
COMMENT ON COLUMN public.shipments.extra_services IS 'Serviços extras: {"photos": true, "video": true} ou URLs';

-- RPC: admin aprova pedido
CREATE OR REPLACE FUNCTION public.admin_approve_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row RECORD; v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.orders SET status = 'approved' WHERE id = p_order_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN to_jsonb(v_row);
END;
$$;

-- RPC: admin rejeita pedido
CREATE OR REPLACE FUNCTION public.admin_reject_order(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row RECORD; v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.orders SET status = 'rejected', message = COALESCE(NULLIF(trim(p_reason), ''), message) WHERE id = p_order_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  RETURN to_jsonb(v_row);
END;
$$;

-- RPC: admin cria pedido na conta do usuário
CREATE OR REPLACE FUNCTION public.admin_create_order_for_user(p_user_id uuid, p_service_id uuid DEFAULT NULL, p_message text DEFAULT NULL)
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
  WITH ins AS (
    INSERT INTO public.orders (user_id, created_by, service_id, message, status)
    VALUES (p_user_id, auth.uid(), p_service_id, NULLIF(trim(p_message), ''), 'pending_approval')
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM ins i;
  RETURN v_result;
END;
$$;

-- RPC: admin registra pacote na conta do usuário (sem vincular a pedido obrigatório)
CREATE OR REPLACE FUNCTION public.admin_register_package(
  p_user_id uuid,
  p_products_description text,
  p_storage_days integer DEFAULT NULL,
  p_received_at timestamptz DEFAULT NOW(),
  p_weight_kg numeric DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pkg RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  INSERT INTO public.user_inventory (
    user_id, order_id, name, products_description, storage_days, received_at,
    weight_kg, photo_url, video_url, notes, status
  )
  VALUES (
    p_user_id,
    p_order_id,
    COALESCE(NULLIF(trim(left(p_products_description, 100)), ''), 'Pacote recebido'),
    NULLIF(trim(p_products_description), ''),
    p_storage_days,
    COALESCE(p_received_at, NOW()),
    p_weight_kg,
    NULLIF(trim(p_photo_url), ''),
    NULLIF(trim(p_video_url), ''),
    NULL,
    'stored'
  )
  RETURNING * INTO v_pkg;
  RETURN to_jsonb(v_pkg);
END;
$$;

-- Atualizar admin_update_order_status para incluir pending_approval, approved, rejected
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_valid text[] := ARRAY['pending_approval','approved','rejected','created','awaiting_arrival','item_received','stored','ready_for_shipment','awaiting_payment','paid','shipped','completed'];
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
