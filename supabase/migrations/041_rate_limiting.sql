-- Rate limiting por usuário e tipo de ação para evitar overload
-- Limites: order_create 10/hora, cart_add 30/min, profile_update 10/min, request_shipment_quote 10/hora

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action_type)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas funções SECURITY DEFINER acessam esta tabela.

-- Configuração de limites (ação, limite, janela em segundos)
-- order_create: 10/hora, cart_add: 30/min, profile_update: 10/min, request_shipment_quote: 10/hora
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_limit INT,
  p_window_seconds INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := NOW();
  v_window_start timestamptz;
  v_count int;
  v_action_label text;
BEGIN
  -- Labels para mensagens amigáveis
  v_action_label := CASE p_action
    WHEN 'order_create' THEN 'criação de pedidos'
    WHEN 'cart_add' THEN 'adicionar ao carrinho'
    WHEN 'profile_update' THEN 'atualização de perfil'
    WHEN 'request_shipment_quote' THEN 'solicitação de orçamento de envio'
    ELSE p_action
  END;

  INSERT INTO public.rate_limit_counters (user_id, action_type, window_start, request_count)
  VALUES (p_user_id, p_action, v_now, 1)
  ON CONFLICT (user_id, action_type) DO UPDATE SET
    window_start = CASE
      WHEN rate_limit_counters.window_start < v_now - (p_window_seconds || ' seconds')::interval
      THEN v_now
      ELSE rate_limit_counters.window_start
    END,
    request_count = CASE
      WHEN rate_limit_counters.window_start < v_now - (p_window_seconds || ' seconds')::interval
      THEN 1
      ELSE rate_limit_counters.request_count + 1
    END
  RETURNING window_start, request_count INTO v_window_start, v_count;

  IF v_count > p_limit THEN
    RAISE EXCEPTION 'Limite de % por período excedido. Tente novamente mais tarde.', v_action_label;
  END IF;
END;
$$;

-- Trigger: rate limit ao criar pedido (apenas quando usuário cria o próprio)
CREATE OR REPLACE FUNCTION public.rate_limit_order_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS NULL OR NEW.created_by = NEW.user_id THEN
    PERFORM public.check_and_increment_rate_limit(NEW.user_id, 'order_create', 10, 3600);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_order_create_trigger ON public.orders;
CREATE TRIGGER rate_limit_order_create_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.rate_limit_order_create();

-- Trigger: rate limit ao adicionar ao carrinho
CREATE OR REPLACE FUNCTION public.rate_limit_cart_add()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.check_and_increment_rate_limit(NEW.user_id, 'cart_add', 30, 60);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_cart_add_trigger ON public.cart_items;
CREATE TRIGGER rate_limit_cart_add_trigger
  BEFORE INSERT ON public.cart_items
  FOR EACH ROW EXECUTE PROCEDURE public.rate_limit_cart_add();

-- Trigger: rate limit ao atualizar perfil (apenas quando usuário atualiza o próprio)
CREATE OR REPLACE FUNCTION public.rate_limit_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    PERFORM public.check_and_increment_rate_limit(NEW.id, 'profile_update', 10, 60);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rate_limit_profile_update_trigger ON public.profiles;
CREATE TRIGGER rate_limit_profile_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.rate_limit_profile_update();

-- Rate limit na RPC user_request_shipment_quote_to_admin
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

  PERFORM public.check_and_increment_rate_limit(p_user_id, 'request_shipment_quote', 10, 3600);

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
