-- Persist shipping quote breakdown for admin auditability.
-- Stores composition details used when setting shipping cost.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_quote_breakdown jsonb;

COMMENT ON COLUMN public.orders.shipping_quote_breakdown IS
  'Composição do orçamento de envio (frete base, taxa por item, buffer etc).';

CREATE OR REPLACE FUNCTION public.admin_set_shipping_await_payment(
  p_order_id uuid,
  p_shipping_cost numeric,
  p_currency text DEFAULT 'JPY',
  p_breakdown jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_shipping_cost IS NULL OR p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;

  IF p_breakdown IS NOT NULL AND jsonb_typeof(p_breakdown) <> 'object' THEN
    RAISE EXCEPTION 'Breakdown inválido';
  END IF;

  WITH updated AS (
    UPDATE public.orders
    SET
      shipping_cost = p_shipping_cost,
      shipping_currency = COALESCE(NULLIF(trim(p_currency), ''), 'JPY'),
      shipping_quote_breakdown = CASE
        WHEN p_breakdown IS NULL THEN NULL
        ELSE p_breakdown
      END,
      status = 'awaiting_payment'
    WHERE id = p_order_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  RETURN v_result;
END;
$$;
