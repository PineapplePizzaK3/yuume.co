-- Inventário: quantidade de itens do pacote + armazenamento automático por data de recebimento

ALTER TABLE public.user_inventory
  ADD COLUMN IF NOT EXISTS items_count INTEGER;

COMMENT ON COLUMN public.user_inventory.items_count IS 'Quantidade de itens no pacote (informado pelo admin no registro)';

-- Atualiza a função admin_register_package para aceitar items_count e registrar received_at automaticamente
CREATE OR REPLACE FUNCTION public.admin_register_package(
  p_user_id uuid,
  p_products_description text,
  p_items_count integer DEFAULT NULL,
  p_weight_kg numeric DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pkg RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO public.user_inventory (
    user_id, order_id, name, products_description, items_count, received_at,
    weight_kg, photo_url, video_url, notes, status
  )
  VALUES (
    p_user_id,
    p_order_id,
    COALESCE(NULLIF(trim(left(p_products_description, 100)), ''), 'Pacote recebido'),
    NULLIF(trim(p_products_description), ''),
    p_items_count,
    NOW(),
    p_weight_kg,
    NULLIF(trim(p_photo_url), ''),
    NULLIF(trim(p_video_url), ''),
    NULL,
    'stored'
  )
  RETURNING * INTO v_pkg;

  -- Ao registrar pacote vinculado a um pedido, finalize o pedido (registrado e finalizado).
  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'completed'
    WHERE id = p_order_id;
  END IF;

  RETURN to_jsonb(v_pkg);
END;
$$;

