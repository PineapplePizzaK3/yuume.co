-- Guard de checkout: higieniza cart_items legados sem variant_id
-- antes de delegar para create_store_order.

CREATE OR REPLACE FUNCTION public.create_store_order_safe(
  p_user_id uuid,
  p_ship_immediately boolean DEFAULT false,
  p_shipping_cost numeric DEFAULT NULL,
  p_shipping_currency text DEFAULT 'JPY',
  p_shipping_address_id uuid DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Preenche variant_id faltante com a variante padrão do produto (quando existir).
  UPDATE public.cart_items ci
  SET variant_id = pv.id
  FROM LATERAL (
    SELECT v.id
    FROM public.product_variants v
    WHERE v.product_id = ci.product_id
    ORDER BY v.is_default DESC, v.created_at ASC
    LIMIT 1
  ) pv
  WHERE ci.user_id = p_user_id
    AND ci.variant_id IS NULL;

  -- Remove lixo residual sem variante (produto sem variante válida).
  DELETE FROM public.cart_items ci
  WHERE ci.user_id = p_user_id
    AND ci.variant_id IS NULL;

  RETURN public.create_store_order(
    p_user_id,
    p_ship_immediately,
    p_shipping_cost,
    p_shipping_currency,
    p_shipping_address_id,
    p_coupon_code
  );
END;
$$;
