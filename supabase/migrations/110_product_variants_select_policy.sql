-- Corrige leitura de variantes no frontend (carrinho/vitrine/detalhe).
-- Sem policy de SELECT em product_variants, o cliente cai em dados do produto pai.

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read visible active variants" ON public.product_variants;
CREATE POLICY "Public can read visible active variants"
ON public.product_variants
FOR SELECT
USING (
  (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.is_active = true
        AND (
          EXISTS (
            SELECT 1
            FROM public.store_products sp
            WHERE sp.product_id = p.id
              AND sp.is_active = true
          )
          OR (
            p.purchase_group_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.purchase_groups g
              WHERE g.id = p.purchase_group_id
                AND g.is_active = true
            )
          )
        )
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.cart_items ci
    WHERE ci.variant_id = product_variants.id
      AND ci.user_id = auth.uid()
  )
);
