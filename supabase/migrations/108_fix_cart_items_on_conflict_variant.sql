-- Fix crítico: ON CONFLICT(user_id, variant_id) do carrinho exige
-- índice/constraint UNIQUE não parcial nessas colunas.
-- O índice anterior era parcial (WHERE variant_id IS NOT NULL),
-- que não é inferido pelo ON CONFLICT usado no frontend.

-- 1) Deduplica possíveis linhas antigas para o mesmo usuário+variante.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, variant_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.cart_items
  WHERE variant_id IS NOT NULL
)
DELETE FROM public.cart_items ci
USING ranked r
WHERE ci.id = r.id
  AND r.rn > 1;

-- 2) Remove índice parcial antigo (não serve para inferência ON CONFLICT).
DROP INDEX IF EXISTS public.uq_cart_items_user_variant;

-- 3) Cria índice UNIQUE não parcial compatível com ON CONFLICT(user_id,variant_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_variant
  ON public.cart_items(user_id, variant_id);
