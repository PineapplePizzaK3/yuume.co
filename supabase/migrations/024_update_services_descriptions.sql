-- Atualiza descrições de serviços (para projetos já existentes)

UPDATE public.services
SET description = '25% do valor da compra + frete'
WHERE name = 'Personal Shopping';

