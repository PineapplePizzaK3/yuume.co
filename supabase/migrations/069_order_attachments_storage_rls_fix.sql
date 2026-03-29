-- Política RLS: usuários autenticados podem fazer INSERT em product-images/orders/{uid}/...
--
-- Se o SQL Editor do painel retornar:
--   ERROR 42501: must be owner of relation objects
-- é porque storage.objects pertence ao role interno do Storage; o editor não é “dono” da relação.
--
-- Opções que funcionam:
--   1) Supabase CLI (recomendado): na pasta do projeto → `supabase link` + `supabase db push`
--   2) Cliente SQL com o usuário postgres (Project Settings → Database → Connection string,
--      use conexão direta / session, não pooler em modo transaction, para DDL)
--   3) Dashboard → Storage → bucket product-images → Policies → criar política de INSERT
--      para role "authenticated" com o mesmo WITH CHECK abaixo (interface “Custom” / SQL da policy, se existir)
--
-- Reforço: split_part no path (evita depender de storage.foldername() no WITH CHECK).

DROP POLICY IF EXISTS "product-images order attachments insert own" ON storage.objects;

CREATE POLICY "product-images order attachments insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND split_part(trim(both '/' from name), '/', 1) = 'orders'
  AND split_part(trim(both '/' from name), '/', 2) = auth.uid()::text
  AND split_part(trim(both '/' from name), '/', 3) <> ''
);
