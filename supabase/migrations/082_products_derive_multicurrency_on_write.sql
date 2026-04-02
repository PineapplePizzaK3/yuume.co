-- Garante consistência de preços no catálogo:
-- base em JPY (price/price_jpy) + derivados USD/BRL calculados no write.

CREATE OR REPLACE FUNCTION public.products_derive_multicurrency_prices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base_jpy numeric;
  v_jpy_usd numeric;
  v_usd_brl numeric;
  v_margin numeric;
  v_platform_fee numeric;
  v_buffer numeric;
  v_mult numeric;
  v_usd numeric;
  v_brl numeric;
BEGIN
  v_base_jpy := ROUND(COALESCE(NEW.price_jpy, NEW.price, 0)::numeric, 2);

  -- "price" permanece como compat legado e espelha a base em JPY.
  NEW.price := v_base_jpy;
  NEW.price_jpy := v_base_jpy;

  IF v_base_jpy <= 0 THEN
    NEW.price_usd := NULL;
    NEW.price_brl := NULL;
    RETURN NEW;
  END IF;

  v_jpy_usd := GREATEST(0.0000001, public.get_setting_number('fx_jpy_usd', 0.0066));
  v_usd_brl := GREATEST(0.0001, public.get_setting_number('fx_usd_brl', 5.50));
  v_margin := GREATEST(0, public.get_setting_number('pricing_margin_percent', 0));
  v_platform_fee := GREATEST(0, public.get_setting_number('pricing_platform_fee_percent', 0));
  v_buffer := GREATEST(0, public.get_setting_number('pricing_jpy_usd_buffer_percent', 5));
  v_mult := (1 + v_margin / 100.0) * (1 + v_platform_fee / 100.0) * (1 + v_buffer / 100.0);

  v_usd := v_base_jpy * v_jpy_usd * v_mult;
  v_brl := v_usd * v_usd_brl;

  NEW.price_usd := ROUND(v_usd::numeric, 4);
  NEW.price_brl := ROUND(v_brl::numeric, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_price_jpy ON public.products;
DROP TRIGGER IF EXISTS trg_products_derive_multicurrency_prices ON public.products;

CREATE TRIGGER trg_products_derive_multicurrency_prices
  BEFORE INSERT OR UPDATE OF price, price_jpy ON public.products
  FOR EACH ROW
  EXECUTE PROCEDURE public.products_derive_multicurrency_prices();

-- Backfill dos derivados para produtos existentes.
UPDATE public.products
SET
  price = ROUND(COALESCE(price_jpy, price, 0)::numeric, 2),
  price_jpy = ROUND(COALESCE(price_jpy, price, 0)::numeric, 2)
WHERE true;
