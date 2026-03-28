-- Notificações internas para admins (ações que exigem intervenção humana).
-- Mantemos no mesmo canal de notifications (por admin/user_id), com type = 'admin_*'.

-- Índice para listagem rápida por tipo+data.
CREATE INDEX IF NOT EXISTS idx_notifications_type_created
  ON public.notifications(type, created_at DESC);

-- Helper: envia notificação para todos os admins.
CREATE OR REPLACE FUNCTION public.notify_admins_action_required(
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, meta)
  SELECT
    pr.id,
    COALESCE(NULLIF(trim(p_type), ''), 'admin_action_required'),
    COALESCE(NULLIF(trim(p_title), ''), 'Ação do admin necessária'),
    NULLIF(trim(p_body), ''),
    COALESCE(p_meta, '{}'::jsonb)
  FROM public.profiles pr
  WHERE pr.role = 'admin';
END;
$$;

-- 1) Pedido criado e aguardando ação inicial do admin (aprovar/orçar).
CREATE OR REPLACE FUNCTION public.notify_admin_order_created_requires_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending_approval', 'awaiting_quote')
     AND (NEW.created_by IS NULL OR NEW.created_by = NEW.user_id) THEN
    PERFORM public.notify_admins_action_required(
      CASE
        WHEN NEW.status = 'pending_approval' THEN 'admin_order_pending_approval'
        ELSE 'admin_order_awaiting_quote'
      END,
      CASE
        WHEN NEW.status = 'pending_approval' THEN 'Pedido aguardando aprovação'
        ELSE 'Pedido aguardando orçamento'
      END,
      'Pedido ' || LEFT(NEW.id::text, 8) || '… requer ação do admin.',
      jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'order_source', NEW.order_source,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_order_created_requires_action ON public.orders;
CREATE TRIGGER trg_notify_admin_order_created_requires_action
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_order_created_requires_action();

-- 2) Pedido entrou em pronto para envio (admin precisa avançar no fluxo de envio).
CREATE OR REPLACE FUNCTION public.notify_admin_order_ready_for_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'ready_for_shipment' THEN
    PERFORM public.notify_admins_action_required(
      'admin_order_ready_for_shipment',
      'Pedido pronto para envio',
      'Pedido ' || LEFT(NEW.id::text, 8) || '… está pronto para ação de envio do admin.',
      jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_order_ready_for_shipment ON public.orders;
CREATE TRIGGER trg_notify_admin_order_ready_for_shipment
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_order_ready_for_shipment();

-- 3) Usuário solicitou serviços extras (fotos/vídeo) no pedido.
CREATE OR REPLACE FUNCTION public.notify_admin_order_extra_services_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_request BOOLEAN;
BEGIN
  v_has_request := (
    COALESCE(NEW.extra_services, '{}'::jsonb) @> '{"photos": true}'::jsonb
    OR COALESCE(NEW.extra_services, '{}'::jsonb) @> '{"video": true}'::jsonb
  );

  IF TG_OP = 'UPDATE'
     AND NEW.extra_services IS DISTINCT FROM OLD.extra_services
     AND NEW.status = 'item_received'
     AND v_has_request THEN
    PERFORM public.notify_admins_action_required(
      'admin_order_extra_services',
      'Serviços extras solicitados',
      'Pedido ' || LEFT(NEW.id::text, 8) || '… recebeu solicitação de fotos/vídeo.',
      jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'extra_services', NEW.extra_services
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_order_extra_services_requested ON public.orders;
CREATE TRIGGER trg_notify_admin_order_extra_services_requested
AFTER UPDATE OF extra_services ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_order_extra_services_requested();

-- 4) Usuário enviou comprovante PIX para pagamento manual de pedido.
CREATE OR REPLACE FUNCTION public.notify_admin_order_pix_comprovante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (COALESCE(trim(NEW.pix_comprovante_url), '') <> '')
     AND (COALESCE(trim(OLD.pix_comprovante_url), '') = '') THEN
    PERFORM public.notify_admins_action_required(
      'admin_order_pix_comprovante',
      'Comprovante PIX de pedido recebido',
      'Pedido ' || LEFT(NEW.id::text, 8) || '… recebeu comprovante PIX para validação.',
      jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_order_pix_comprovante ON public.orders;
CREATE TRIGGER trg_notify_admin_order_pix_comprovante
AFTER UPDATE OF pix_comprovante_url ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_order_pix_comprovante();

-- 5) Nova solicitação de envio criada pelo usuário.
CREATE OR REPLACE FUNCTION public.notify_admin_shipment_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'requested' THEN
    PERFORM public.notify_admins_action_required(
      'admin_shipment_requested',
      'Nova solicitação de envio',
      'Envio ' || LEFT(NEW.id::text, 8) || '… aguardando ação do admin.',
      jsonb_build_object(
        'shipment_id', NEW.id,
        'user_id', NEW.user_id,
        'status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_shipment_requested ON public.shipments;
CREATE TRIGGER trg_notify_admin_shipment_requested
AFTER INSERT ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_shipment_requested();

-- 6) Usuário enviou comprovante PIX de recarga da carteira.
CREATE OR REPLACE FUNCTION public.notify_admin_wallet_topup_comprovante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'pending'
     AND (COALESCE(trim(NEW.comprovante_url), '') <> '')
     AND (COALESCE(trim(OLD.comprovante_url), '') = '') THEN
    PERFORM public.notify_admins_action_required(
      'admin_wallet_topup_comprovante',
      'Comprovante PIX de recarga recebido',
      'Recarga ' || LEFT(NEW.id::text, 8) || '… aguardando validação do admin.',
      jsonb_build_object(
        'topup_request_id', NEW.id,
        'user_id', NEW.user_id,
        'amount_jpy', NEW.amount_jpy,
        'amount_brl', NEW.amount_brl
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_wallet_topup_comprovante ON public.wallet_topup_requests;
CREATE TRIGGER trg_notify_admin_wallet_topup_comprovante
AFTER UPDATE OF comprovante_url ON public.wallet_topup_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_wallet_topup_comprovante();

