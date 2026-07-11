-- Personal Shopping: 30% flat sobre o valor da compra (sem taxa por item) + frete.
UPDATE public.services
SET description = '30% flat do valor da compra + frete'
WHERE name = 'Personal Shopping';
