-- Impedir exclusão de produto que está em pedidos; retornar mensagem amigável
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_in_orders int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*)::int INTO v_in_orders
  FROM public.order_items
  WHERE product_id = p_id;

  IF v_in_orders > 0 THEN
    RAISE EXCEPTION 'Não é possível remover este produto pois existem % pedido(s) que o incluem. Desative o produto em vez disso.', v_in_orders;
  END IF;

  DELETE FROM public.products WHERE id = p_id;
END;
$$;
