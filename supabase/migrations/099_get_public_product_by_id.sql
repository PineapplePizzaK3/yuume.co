-- Página pública de produto: retorna JSON do item se estiver na vitrine (store) ou em grupo ativo.

CREATE OR REPLACE FUNCTION public.get_public_product_by_id(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  SELECT (to_jsonb(p) - 'admin_product_url')
  INTO v
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.is_active = true
    AND (
      EXISTS (
        SELECT 1
        FROM public.store_products sp
        WHERE sp.product_id = p.id AND sp.is_active = true
      )
      OR (
        p.purchase_group_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.purchase_groups g
          WHERE g.id = p.purchase_group_id AND g.is_active = true
        )
      )
    )
  LIMIT 1;

  RETURN v;
END;
$$;

COMMENT ON FUNCTION public.get_public_product_by_id(uuid) IS
  'Retorna dados públicos do produto (sem admin_product_url) se ativo na loja ou em grupo ativo; senão NULL.';
