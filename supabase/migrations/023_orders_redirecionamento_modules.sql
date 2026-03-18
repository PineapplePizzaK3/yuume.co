-- Redirecionamento: módulos de contratação
-- - self_buy: usuário compra e envia para nosso endereço
-- - assisted_buy: nós compramos para o usuário, com pré-pagamento via plataforma

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_module TEXT;

-- Comentário e constraint leve (mantém compatível com dados antigos)
COMMENT ON COLUMN public.orders.order_module IS 'Módulo do pedido: self_buy | assisted_buy (principalmente para Redirecionamento)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND constraint_name = 'orders_order_module_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_order_module_check
      CHECK (order_module IS NULL OR order_module IN ('self_buy','assisted_buy'));
  END IF;
END $$;

