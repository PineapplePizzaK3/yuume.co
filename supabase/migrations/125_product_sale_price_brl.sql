-- Preço unitário de venda em BRL (taxas de câmbio + markup Wise + taxa grupo quando aplicável).
-- Frete internacional continua separado.

CREATE OR REPLACE FUNCTION public.compute_product_unit_sale_usd(
  p_price_jpy numeric,
  p_channel text DEFAULT 'store'
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_jpy numeric;
  v_jpy_usd numeric;
  v_markup numeric;
  v_jpy_usd_eff numeric;
  v_unit_usd numeric;
  v_fee_unit_usd numeric;
BEGIN
  v_jpy := GREATEST(COALESCE(p_price_jpy, 0), 0);
  IF v_jpy <= 0 THEN
    RETURN 0;
  END IF;

  v_jpy_usd := GREATEST(0.0000001, public.get_setting_number('fx_jpy_usd', 0.0066));
  v_markup := GREATEST(0, public.get_setting_number('wise_usd_jpy_withdrawal_markup_percent', 0.73));
  v_jpy_usd_eff := v_jpy_usd * (1 + v_markup / 100.0);
  v_unit_usd := v_jpy * v_jpy_usd_eff;

  IF lower(trim(COALESCE(p_channel, 'store'))) = 'grupo' THEN
    v_fee_unit_usd := GREATEST(0, public.get_setting_number('grupo_compras_fee_per_unit_usd', 1.90));
    v_unit_usd := v_unit_usd * 1.20 + v_fee_unit_usd;
  END IF;

  RETURN ROUND(v_unit_usd::numeric, 4);
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_product_unit_sale_brl(
  p_price_jpy numeric,
  p_channel text DEFAULT 'store'
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_usd_brl numeric;
  v_unit_usd numeric;
BEGIN
  v_unit_usd := public.compute_product_unit_sale_usd(p_price_jpy, p_channel);
  IF v_unit_usd <= 0 THEN
    RETURN 0;
  END IF;
  v_usd_brl := GREATEST(0.0001, public.get_setting_number('fx_usd_brl', 5.50));
  RETURN ROUND((v_unit_usd * v_usd_brl)::numeric, 2);
END;
$$;

COMMENT ON FUNCTION public.compute_product_unit_sale_brl(numeric, text) IS
  'Preço unitário ao cliente em BRL com taxas embutidas (câmbio + Wise markup + taxa grupo). Frete não incluso.';

CREATE OR REPLACE FUNCTION public.get_public_ephemeral_product(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ephemeral_products%ROWTYPE;
  v_price_jpy numeric;
  v_unit_usd numeric;
  v_unit_brl numeric;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_row
  FROM public.ephemeral_products
  WHERE token = trim(p_token)
    AND expires_at > now()
    AND is_available = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_price_jpy := COALESCE(v_row.current_price_jpy, v_row.snapshot_price_jpy);
  v_unit_usd := public.compute_product_unit_sale_usd(v_price_jpy, 'store');
  v_unit_brl := public.compute_product_unit_sale_brl(v_price_jpy, 'store');

  RETURN jsonb_build_object(
    'token', v_row.token,
    'store_id', v_row.store_id,
    'external_url', v_row.external_url,
    'title', COALESCE(v_row.current_title, v_row.title),
    'price_jpy', v_price_jpy,
    'price_usd', v_unit_usd,
    'unit_sale_brl', v_unit_brl,
    'currency', v_row.currency,
    'image_url', COALESCE(v_row.current_image_url, v_row.image_url),
    'expires_at', v_row.expires_at,
    'is_available', v_row.is_available
  );
END;
$$;
