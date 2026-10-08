-- Cart lines that came from a temporary listing leave the cart when that listing expires.
-- Checkout already ignores expires_at <= now(); this removes the rows so the cart and badge match.

CREATE OR REPLACE FUNCTION public.list_my_ephemeral_cart_items()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  ephemeral_token text,
  quantity integer,
  created_at timestamptz,
  updated_at timestamptz,
  store_id text,
  external_url text,
  title text,
  price_jpy numeric,
  currency text,
  image_url text,
  expires_at timestamptz,
  is_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.cart_ephemeral_items AS c
  USING public.ephemeral_products AS e
  WHERE c.ephemeral_token = e.token
    AND c.user_id = v_uid
    AND e.expires_at <= now();

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.ephemeral_token,
    c.quantity,
    c.created_at,
    c.updated_at,
    e.store_id,
    e.external_url,
    COALESCE(e.current_title, e.title) AS title,
    COALESCE(e.current_price_jpy, e.snapshot_price_jpy) AS price_jpy,
    e.currency,
    COALESCE(e.current_image_url, e.image_url) AS image_url,
    e.expires_at,
    e.is_available
  FROM public.cart_ephemeral_items AS c
  JOIN public.ephemeral_products AS e ON e.token = c.ephemeral_token
  WHERE c.user_id = v_uid
    AND e.expires_at > now()
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ephemeral_cart_item(
  p_token text,
  p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_qty integer;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Faça login novamente';
  END IF;

  v_token := trim(COALESCE(p_token, ''));
  v_qty := GREATEST(1, LEAST(COALESCE(p_quantity, 1), 99));

  SELECT e.expires_at
  INTO v_expires_at
  FROM public.cart_ephemeral_items AS c
  JOIN public.ephemeral_products AS e ON e.token = c.ephemeral_token
  WHERE c.user_id = v_uid
    AND c.ephemeral_token = v_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item temporário não encontrado no carrinho';
  END IF;

  IF v_expires_at <= now() THEN
    DELETE FROM public.cart_ephemeral_items
    WHERE user_id = v_uid
      AND ephemeral_token = v_token;
    RAISE EXCEPTION 'Produto temporário expirado';
  END IF;

  UPDATE public.cart_ephemeral_items
  SET quantity = v_qty, updated_at = now()
  WHERE user_id = v_uid
    AND ephemeral_token = v_token;

  RETURN jsonb_build_object('ok', true);
END;
$$;
