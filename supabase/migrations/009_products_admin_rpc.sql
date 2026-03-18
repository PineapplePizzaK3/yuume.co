-- RPCs para CRUD de produtos, executando no servidor com SECURITY DEFINER.
-- Garante que products existe (caso 005 não tenha rodado).

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policies (is_admin vem de 008; se faltar, criar aqui)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- admin_list_products: retorna todos (admin); outros: create/update/delete.
CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
    FROM (SELECT * FROM public.products ORDER BY created_at DESC) p);
END;
$$;

-- Contorna possíveis bloqueios do PostgREST/RLS no caminho direto da tabela.
-- Só admin (is_admin() = true) pode chamar.

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
    INSERT INTO public.products (name, description, price, image_url, is_active)
    VALUES (
      (p_product->>'name')::text,
      NULLIF(trim(COALESCE(p_product->>'description','')), '')::text,
      (p_product->>'price')::numeric,
      NULLIF(trim(COALESCE(p_product->>'image_url','')), '')::text,
      COALESCE((p_product->>'is_active')::boolean, true)
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

CREATE OR REPLACE FUNCTION public.admin_delete_product(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.products WHERE id = p_id;
END;
$$;
