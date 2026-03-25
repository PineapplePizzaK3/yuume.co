-- Cupons de desconto no checkout da loja
-- Valores em BRL (moeda dos produtos)

-- Tabela de cupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_order_brl NUMERIC(12,2) DEFAULT NULL,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NULL,
  valid_until TIMESTAMPTZ DEFAULT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar cupons
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Admins can manage coupons" ON public.coupons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Usuários autenticados podem validar cupons (SELECT)
DROP POLICY IF EXISTS "Authenticated users can validate coupons" ON public.coupons;
CREATE POLICY "Authenticated users can validate coupons" ON public.coupons
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(LOWER(TRIM(code)));

-- Colunas no pedido para registrar cupom aplicado
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT NULL;

COMMENT ON COLUMN public.orders.coupon_id IS 'Cupom aplicado no checkout (loja)';
COMMENT ON COLUMN public.orders.discount_amount IS 'Valor do desconto em BRL';

-- RPC: validar cupom e retornar desconto (para uso no frontend antes de criar pedido)
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code TEXT,
  p_subtotal_brl NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount NUMERIC;
  v_code_trimmed TEXT;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código não informado');
  END IF;

  v_code_trimmed := LOWER(TRIM(p_code));

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE LOWER(TRIM(code)) = v_code_trimmed;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom inválido');
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND NOW() < v_coupon.valid_from THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom ainda não está válido');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND NOW() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom expirado');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Cupom esgotado');
  END IF;

  IF v_coupon.min_order_brl IS NOT NULL AND p_subtotal_brl < v_coupon.min_order_brl THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Compra mínima de R$ ' || to_char(v_coupon.min_order_brl, 'FM999G999G990D00') || ' para usar este cupom'
    );
  END IF;

  IF p_subtotal_brl <= 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Subtotal inválido');
  END IF;

  IF v_coupon.discount_type = 'percent' THEN
    v_discount := ROUND((p_subtotal_brl * v_coupon.discount_value / 100)::numeric, 2);
    v_discount := LEAST(v_discount, p_subtotal_brl);
  ELSE
    v_discount := LEAST(v_coupon.discount_value, p_subtotal_brl);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount_brl', v_discount,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'description', v_coupon.description
  );
END;
$$;

-- Atualizar create_store_order para aceitar cupom
CREATE OR REPLACE FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean DEFAULT false,
  p_shipping_cost numeric DEFAULT NULL,
  p_shipping_currency text DEFAULT 'JPY',
  p_shipping_address_id uuid DEFAULT NULL,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item RECORD;
  v_total numeric := 0;
  v_order jsonb;
  v_ship_cost numeric;
  v_ship_currency text;
  v_coupon_result jsonb;
  v_coupon_id uuid;
  v_discount numeric := 0;
  v_code_trimmed text;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  -- Endereço opcional; se informado, validar que pertence ao usuário
  IF p_shipping_address_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.addresses a
    WHERE a.id = p_shipping_address_id
      AND a.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Endereço inválido';
  END IF;

  IF p_shipping_cost IS NOT NULL AND p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'Valor do frete inválido';
  END IF;

  -- Validar stock antes de criar o pedido (stock_quantity NULL = ilimitado)
  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.name, p.stock_quantity
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    WHERE ci.user_id = p_user_id
  LOOP
    IF v_item.stock_quantity IS NOT NULL AND v_item.stock_quantity < v_item.quantity THEN
      RAISE EXCEPTION 'Produto "%" não possui estoque suficiente. Disponível: %, solicitado: %',
        v_item.name, v_item.stock_quantity, v_item.quantity;
    END IF;
  END LOOP;

  v_ship_cost := CASE WHEN p_ship_immediately THEN p_shipping_cost ELSE NULL END;
  v_ship_currency := COALESCE(NULLIF(trim(p_shipping_currency), ''), 'JPY');

  -- Inserir pedido (shipping_address_id pode ser NULL)
  INSERT INTO public.orders (user_id, created_by, order_source, ship_immediately, status, shipping_address_id)
  VALUES (
    p_user_id,
    p_user_id,
    'store',
    p_ship_immediately,
    'awaiting_payment',
    p_shipping_address_id
  )
  RETURNING id INTO v_order_id;

  -- Inserir order_items e calcular subtotal
  FOR v_item IN
    SELECT ci.product_id, ci.quantity, p.price, p.stock_quantity
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id AND p.is_active = true
    WHERE ci.user_id = p_user_id
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.price);
    v_total := v_total + (v_item.price * v_item.quantity);

    IF v_item.stock_quantity IS NOT NULL THEN
      UPDATE public.products
      SET
        stock_quantity = GREATEST(stock_quantity - v_item.quantity, 0),
        is_active = CASE WHEN (stock_quantity - v_item.quantity) <= 0 THEN false ELSE is_active END,
        updated_at = NOW()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  IF v_total <= 0 THEN
    DELETE FROM public.orders WHERE id = v_order_id;
    RAISE EXCEPTION 'Carrinho vazio ou inválido';
  END IF;

  -- Validar e aplicar cupom
  IF p_coupon_code IS NOT NULL AND trim(p_coupon_code) <> '' THEN
    v_coupon_result := public.validate_coupon(trim(p_coupon_code), v_total);
    IF (v_coupon_result->>'valid')::boolean = true THEN
      v_coupon_id := (v_coupon_result->>'coupon_id')::uuid;
      v_discount := (v_coupon_result->>'discount_brl')::numeric;
      v_discount := LEAST(v_discount, v_total);
    ELSE
      DELETE FROM public.orders WHERE id = v_order_id;
      RAISE EXCEPTION '%', v_coupon_result->>'error';
    END IF;
  END IF;

  v_total := GREATEST(v_total - v_discount, 0);

  UPDATE public.orders
  SET total_amount = v_total,
      shipping_cost = v_ship_cost,
      shipping_currency = CASE WHEN v_ship_cost IS NOT NULL THEN v_ship_currency ELSE shipping_currency END,
      coupon_id = v_coupon_id,
      discount_amount = CASE WHEN v_discount > 0 THEN v_discount ELSE NULL END
  WHERE id = v_order_id;

  -- Incrementar used_count do cupom
  IF v_coupon_id IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = v_coupon_id;
  END IF;

  DELETE FROM public.cart_items WHERE user_id = p_user_id;

  SELECT to_jsonb(o) INTO v_order FROM public.orders o WHERE id = v_order_id;
  RETURN v_order;
END;
$$;

-- Inserir cupom de exemplo para testes (opcional - pode remover em produção)
-- INSERT INTO public.coupons (code, discount_type, discount_value, min_order_brl, description)
-- VALUES ('BEMVINDO10', 'percent', 10, 50, '10% de desconto na primeira compra acima de R$ 50');
