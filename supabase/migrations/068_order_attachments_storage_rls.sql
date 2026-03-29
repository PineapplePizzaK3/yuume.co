-- Anexos de pedido (Serviços): upload em product-images/orders/{user_id}/...
-- A política de admin em 012 só permitia INSERT para admins — usuários recebiam erro RLS.

DROP POLICY IF EXISTS "product-images order attachments insert own" ON storage.objects;

CREATE POLICY "product-images order attachments insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'orders'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

COMMENT ON POLICY "product-images order attachments insert own" ON storage.objects IS
'Dono do pedido pode enviar imagens em orders/{auth.uid()}/... (anexos de solicitação de serviço).';
