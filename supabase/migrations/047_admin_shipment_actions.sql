-- Admin: ações sobre envios (shipments) - definir frete, marcar enviado, finalizar

-- Definir frete no envio e marcar como aguardando pagamento
CREATE OR REPLACE FUNCTION public.admin_set_shipment_freight(
  p_shipment_id uuid,
  p_shipping_cost numeric,
  p_currency text DEFAULT 'JPY'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids uuid[];
  v_first_order_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_shipping_cost IS NULL OR p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;

  SELECT (
    SELECT COALESCE(array_agg(DISTINCT ui.order_id) FILTER (WHERE ui.order_id IS NOT NULL), ARRAY[]::uuid[])
    FROM public.shipment_items si
    JOIN public.user_inventory ui ON ui.id = si.inventory_id
    WHERE si.shipment_id = p_shipment_id
  ) INTO v_order_ids;

  UPDATE public.shipments
  SET shipping_cost = p_shipping_cost,
      shipping_currency = COALESCE(NULLIF(trim(p_currency), ''), 'JPY'),
      status = 'awaiting_payment',
      updated_at = NOW()
  WHERE id = p_shipment_id
    AND status = 'requested';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envio não encontrado ou já possui frete definido';
  END IF;

  -- Atualiza o primeiro pedido com o frete; os demais com 0 (pagamento único)
  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    v_first_order_id := v_order_ids[1];
    UPDATE public.orders
    SET shipping_cost = p_shipping_cost,
        shipping_currency = COALESCE(NULLIF(trim(p_currency), ''), 'JPY'),
        status = 'awaiting_payment'
    WHERE id = v_first_order_id;

    IF array_length(v_order_ids, 1) > 1 THEN
      UPDATE public.orders
      SET shipping_cost = 0,
          shipping_currency = COALESCE(NULLIF(trim(p_currency), ''), 'JPY'),
          status = 'awaiting_payment'
      WHERE id = ANY(v_order_ids[2:array_length(v_order_ids, 1)])
        AND status IN ('ready_for_shipment', 'products_paid');
    END IF;
  END IF;
END;
$$;

-- Marcar envio como enviado (com código de rastreio)
CREATE OR REPLACE FUNCTION public.admin_set_shipment_shipped(
  p_shipment_id uuid,
  p_tracking_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT (
    SELECT COALESCE(array_agg(DISTINCT ui.order_id) FILTER (WHERE ui.order_id IS NOT NULL), ARRAY[]::uuid[])
    FROM public.shipment_items si
    JOIN public.user_inventory ui ON ui.id = si.inventory_id
    WHERE si.shipment_id = p_shipment_id
  ) INTO v_order_ids;

  UPDATE public.shipments
  SET status = 'shipped',
      tracking_code = NULLIF(trim(p_tracking_code), ''),
      updated_at = NOW()
  WHERE id = p_shipment_id
    AND status IN ('awaiting_payment', 'paid');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envio não encontrado ou não está pronto para marcar como enviado';
  END IF;

  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    UPDATE public.user_inventory
    SET status = 'shipped'
    WHERE id IN (
      SELECT si.inventory_id FROM public.shipment_items si WHERE si.shipment_id = p_shipment_id
    );

    UPDATE public.orders
    SET status = 'shipped'
    WHERE id = ANY(v_order_ids) AND status IN ('awaiting_payment', 'paid');
  END IF;
END;
$$;

-- Marcar envio como finalizado
CREATE OR REPLACE FUNCTION public.admin_set_shipment_completed(p_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ids uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT (
    SELECT COALESCE(array_agg(DISTINCT ui.order_id) FILTER (WHERE ui.order_id IS NOT NULL), ARRAY[]::uuid[])
    FROM public.shipment_items si
    JOIN public.user_inventory ui ON ui.id = si.inventory_id
    WHERE si.shipment_id = p_shipment_id
  ) INTO v_order_ids;

  UPDATE public.shipments
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_shipment_id
    AND status = 'shipped';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envio não encontrado ou ainda não foi enviado';
  END IF;

  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    UPDATE public.orders
    SET status = 'completed'
    WHERE id = ANY(v_order_ids) AND status = 'shipped';
  END IF;
END;
$$;

-- Admin: marcar envio como pago (confirmação manual quando pagamento foi recebido fora do sistema)
CREATE OR REPLACE FUNCTION public.admin_set_shipment_paid(p_shipment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.shipments
  SET status = 'paid',
      updated_at = NOW()
  WHERE id = p_shipment_id
    AND status = 'awaiting_payment';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envio não encontrado ou não está aguardando pagamento';
  END IF;
END;
$$;

-- Trigger: quando um pedido é pago, atualiza o envio para 'paid' se este pedido está no envio
CREATE OR REPLACE FUNCTION public.sync_shipment_on_order_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    UPDATE public.shipments sh
    SET status = 'paid',
        updated_at = NOW()
    WHERE sh.status = 'awaiting_payment'
      AND EXISTS (
        SELECT 1 FROM public.shipment_items si
        JOIN public.user_inventory ui ON ui.id = si.inventory_id
        WHERE si.shipment_id = sh.id AND ui.order_id = NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shipment_on_order_paid ON public.orders;
CREATE TRIGGER trg_sync_shipment_on_order_paid
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_shipment_on_order_paid();
