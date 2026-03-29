-- Fix: decrement_stock_on_order_paid updated cart_items to quantity = 0 before DELETE,
-- which violates CHECK (quantity > 0) on cart_items (constraint cart_items_quantity_check).
-- Wallet/card checkout that sets order to paid/products_paid therefore failed mid-trigger.
-- Solution: DELETE rows fully consumed; UPDATE only rows that still have quantity > order qty.

CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.order_source <> 'store' THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'awaiting_payment' OR NOT (NEW.status IN ('paid', 'products_paid')) THEN
    RETURN NEW;
  END IF;

  -- Validar estoque antes de permitir a transição
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.name, p.stock_quantity
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    IF v_item.stock_quantity IS NOT NULL AND v_item.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Produto "%" não possui estoque suficiente. Disponível: %, solicitado: %',
        v_item.name, v_item.stock_quantity, v_item.quantity;
    END IF;
  END LOOP;

  -- Debitar estoque
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, p.stock_quantity
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id AND p.stock_quantity IS NOT NULL
  LOOP
    UPDATE public.products
    SET stock_quantity = GREATEST(stock_quantity - v_item.quantity, 0),
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  -- Descontar do carrinho sem nunca gravar quantity = 0 (CHECK quantity > 0)
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
  LOOP
    DELETE FROM public.cart_items
    WHERE user_id = NEW.user_id
      AND product_id = v_item.product_id
      AND quantity <= v_item.quantity;

    UPDATE public.cart_items
    SET quantity = quantity - v_item.quantity
    WHERE user_id = NEW.user_id
      AND product_id = v_item.product_id;
  END LOOP;

  RETURN NEW;
END;
$$;
