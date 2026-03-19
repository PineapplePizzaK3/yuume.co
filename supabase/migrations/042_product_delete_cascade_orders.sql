-- admin_delete_product: remover pedidos que contêm o produto e depois remover o produto
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_ids uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Pedidos que possuem itens com este produto
  SELECT ARRAY_AGG(DISTINCT order_id)
  INTO v_order_ids
  FROM public.order_items
  WHERE product_id = p_id;

  -- Excluir pedidos (CASCADE remove order_items)
  IF v_order_ids IS NOT NULL AND array_length(v_order_ids, 1) > 0 THEN
    DELETE FROM public.orders WHERE id = ANY(v_order_ids);
  END IF;

  -- Remover produto de product_ids nos grupos de compra (consistência)
  UPDATE public.purchase_groups
  SET product_ids = (
    SELECT COALESCE(jsonb_agg(elem::uuid), '[]'::jsonb)
    FROM jsonb_array_elements_text(product_ids) AS elem
    WHERE elem::uuid != p_id
  )
  WHERE product_ids @> jsonb_build_array(p_id::text);

  DELETE FROM public.products WHERE id = p_id;
END;
$$;
