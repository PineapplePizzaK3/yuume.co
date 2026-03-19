-- Logs de atividades dos usuários (não admins)
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver logs de usuários
CREATE POLICY "Admins can view user activity logs"
  ON public.user_activity_logs
  FOR SELECT
  USING (public.is_admin());

-- Trigger: logar quando usuário cria pedido (apenas se foi o próprio usuário, não admin criando por ele)
CREATE OR REPLACE FUNCTION public.log_user_order_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS NULL OR NEW.created_by = NEW.user_id THEN
    INSERT INTO public.user_activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.user_id,
      'order_create',
      'order',
      NEW.id,
      jsonb_build_object('order_source', NEW.order_source, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_created_user_log ON public.orders;
CREATE TRIGGER on_order_created_user_log
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.log_user_order_created();

-- Trigger: logar quando usuário adiciona item ao carrinho
CREATE OR REPLACE FUNCTION public.log_user_cart_add()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    NEW.user_id,
    'cart_add',
    'product',
    NEW.product_id,
    jsonb_build_object('quantity', NEW.quantity)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cart_item_added_user_log ON public.cart_items;
CREATE TRIGGER on_cart_item_added_user_log
  AFTER INSERT ON public.cart_items
  FOR EACH ROW EXECUTE PROCEDURE public.log_user_cart_add();

-- Trigger: logar quando usuário atualiza o próprio perfil (não quando admin edita)
CREATE OR REPLACE FUNCTION public.log_user_profile_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    INSERT INTO public.user_activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.id,
      'profile_update',
      'profile',
      NEW.id,
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated_user_log ON public.profiles;
CREATE TRIGGER on_profile_updated_user_log
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.log_user_profile_updated();

-- Admin: listar logs de atividades dos usuários
CREATE OR REPLACE FUNCTION public.admin_list_user_logs(p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        l.id,
        l.user_id,
        l.action,
        l.entity_type,
        l.entity_id,
        l.details,
        l.created_at,
        p.name AS user_name,
        p.email AS user_email
      FROM public.user_activity_logs l
      LEFT JOIN public.profiles p ON p.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT LEAST(COALESCE(NULLIF(p_limit, 0), 100), 500)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) r
  );
END;
$$;
