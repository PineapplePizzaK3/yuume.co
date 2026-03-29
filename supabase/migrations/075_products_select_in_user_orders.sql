-- Permitir que o cliente veja dados de produtos que constam nos próprios pedidos,
-- mesmo que o produto tenha sido desativado na loja (embed order_items → products
-- voltava vazio e o pedido da loja aparecia sem nomes/preços visíveis).

CREATE POLICY "Users can view products from their orders"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = products.id
      AND o.user_id = auth.uid()
  )
);
