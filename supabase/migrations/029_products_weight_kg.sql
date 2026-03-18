-- Adiciona peso (kg) aos produtos para cálculo de frete no carrinho.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(12,3) NOT NULL DEFAULT 0;

-- Atualiza RPCs de admin para aceitar weight_kg no payload.
CREATE OR REPLACE FUNCTION public.admin_create_product(p_product jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  WITH inserted AS (
    INSERT INTO public.products (name, description, price, image_url, is_active, weight_kg)
    VALUES (
      (p_product->>'name')::text,
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      (p_product->>'price')::numeric,
      NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text,
      COALESCE((p_product->>'is_active')::boolean, true),
      COALESCE((p_product->>'weight_kg')::numeric, 0)
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_product(p_id uuid, p_product jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  WITH updated AS (
    UPDATE public.products
    SET
      name = (p_product->>'name')::text,
      description = NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      price = (p_product->>'price')::numeric,
      image_url = NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text,
      is_active = COALESCE((p_product->>'is_active')::boolean, true),
      weight_kg = COALESCE((p_product->>'weight_kg')::numeric, 0),
      updated_at = NOW()
    WHERE id = p_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  RETURN v_result;
END;
$$;

