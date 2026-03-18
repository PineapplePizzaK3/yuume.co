-- Função is_admin() com SECURITY DEFINER para evitar problemas de RLS
-- quando a policy de products consulta profiles (profiles pode ter RLS que bloqueia)
-- A função roda com privilégios do owner e ignora RLS em profiles

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Substituir a policy existente por uma que usa a função
DROP POLICY IF EXISTS "Admins can manage products" ON products;

CREATE POLICY "Admins can manage products" ON products
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
