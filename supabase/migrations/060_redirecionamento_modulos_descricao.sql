-- Atualiza descrição do serviço Redirecionamento (nomes dos módulos na UI)

UPDATE public.services
SET description = 'Módulos: Redirecionamento Padrão | Redirecionamento Assistido + frete'
WHERE name = 'Redirecionamento';

COMMENT ON COLUMN public.orders.order_module IS
  'Módulo do pedido: self_buy = Redirecionamento Padrão | assisted_buy = Redirecionamento Assistido (compras pela plataforma)';
