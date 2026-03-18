-- Atualiza RPC da loja para aceitar uma estimativa de shipping_cost (frete)
-- usada para pré-preencher o admin na etapa de "Definir frete".

CREATE OR REPLACE FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean DEFAULT false,
  p_shipping_cost numeric DEFAULT NULL,
  p_shipping_currency text DEFAULT 'JPY'
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
  v_ship_cost numeric;
  v_ship_currency text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_shipping_cost IS NOT NULL AND p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;

  v_ship_cost := CASE WHEN p_ship_immediately THEN p_shipping_cost ELSE NULL END;
  v_ship_currency := COALESCE(NULLIF(trim(p_shipping_currency), ''), 'JPY');

  -- Inserir pedido
  INSERT INTO public.orders (user_id, created_by, order_source, ship_immediately, status)
  VALUES (
    p_user_id,
    p_user_id,
    'store',
    p_ship_immediately,
    'awaiting_payment'
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

  UPDATE public.orders
  SET total_amount = v_total,
      shipping_cost = v_ship_cost,
      shipping_currency = CASE WHEN v_ship_cost IS NOT NULL THEN v_ship_currency ELSE shipping_currency END
  WHERE id = v_order_id;

  -- Limpar carrinho
  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  SELECT to_jsonb(o) INTO v_order FROM public.orders o WHERE o.id = v_order_id;
  RETURN v_order;
END;
$$;

