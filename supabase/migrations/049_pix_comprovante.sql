-- PIX manual: comprovante de pagamento
-- Permite usuário enviar comprovante PIX para pedidos em awaiting_payment

-- Storage: usuários podem fazer upload em pix-comprovantes/{user_id}/
DROP POLICY IF EXISTS "Users can upload pix comprovante" ON storage.objects;
CREATE POLICY "Users can upload pix comprovante" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'pix-comprovantes'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pix_comprovante_url TEXT DEFAULT NULL;
COMMENT ON COLUMN public.orders.pix_comprovante_url IS 'URL do comprovante PIX enviado pelo usuário (pagamento manual)';

-- RPC: usuário envia comprovante PIX para seu pedido
CREATE OR REPLACE FUNCTION public.submit_pix_comprovante(p_order_id uuid, p_comprovante_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_order record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  IF v_order.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Pedido não pertence ao usuário';
  END IF;
  IF v_order.status != 'awaiting_payment' THEN
    RAISE EXCEPTION 'Pedido não está aguardando pagamento';
  END IF;
  IF p_comprovante_url IS NULL OR trim(p_comprovante_url) = '' THEN
    RAISE EXCEPTION 'URL do comprovante é obrigatória';
  END IF;

  UPDATE public.orders
  SET pix_comprovante_url = trim(p_comprovante_url)
  WHERE id = p_order_id;

  SELECT to_jsonb(o) INTO v_result FROM public.orders o WHERE id = p_order_id;
  RETURN v_result;
END;
$$;
