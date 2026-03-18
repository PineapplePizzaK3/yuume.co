-- Permitir que o usuário edite/remova seus pedidos (com restrições por status na UI).
-- A RLS garante que só o dono do pedido consiga alterar/remover.

DO $$
BEGIN
  -- Policies podem já existir; removemos antes para garantir consistência.
  DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
  DROP POLICY IF EXISTS "Users can delete own orders" ON public.orders;

  CREATE POLICY "Users can update own orders" ON public.orders
    FOR UPDATE USING (auth.uid() = user_id);

  CREATE POLICY "Users can delete own orders" ON public.orders
    FOR DELETE USING (auth.uid() = user_id);
END $$;

