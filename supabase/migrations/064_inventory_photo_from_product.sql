-- Garante foto no inventário para itens vindos da loja.
-- 1) Ajusta função de criação de inventário pós-pagamento para persistir photo_url.
-- 2) Backfill dos registros antigos sem photo_url quando houver product_id.

CREATE OR REPLACE FUNCTION public.store_order_add_to_inventory(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.order_source <> 'store' OR v_order.ship_immediately THEN
    RAISE EXCEPTION 'Pedido inválido para esta operação';
  END IF;

  IF v_order.status <> 'paid' THEN
    RAISE EXCEPTION 'Pedido deve estar pago';
  END IF;

  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.name, p.image_url
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  LOOP
    INSERT INTO public.user_inventory (user_id, order_id, product_id, name, photo_url, status)
    VALUES (
      v_order.user_id,
      p_order_id,
      v_item.product_id,
      v_item.name || ' (x' || v_item.quantity || ')',
      NULLIF(trim(COALESCE(v_item.image_url, '')), ''),
      'stored'
    );
  END LOOP;
END;
$$;

UPDATE public.user_inventory ui
SET photo_url = NULLIF(trim(COALESCE(p.image_url, '')), '')
FROM public.products p
WHERE ui.product_id = p.id
  AND (ui.photo_url IS NULL OR trim(ui.photo_url) = '')
  AND p.image_url IS NOT NULL
  AND trim(p.image_url) <> '';
