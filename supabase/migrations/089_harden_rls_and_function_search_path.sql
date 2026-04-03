-- Supabase warnings hardening
-- 1) RLS policy always true (fraud_logs)
-- 2) Mutable search_path in functions

DROP POLICY IF EXISTS "System can insert fraud logs" ON public.fraud_logs;
CREATE POLICY "System can insert fraud logs" ON public.fraud_logs
  FOR INSERT
  TO service_role
  WITH CHECK (auth.role() = 'service_role');

ALTER FUNCTION public.generate_device_fingerprint(TEXT, TEXT, TEXT, TEXT, TEXT)
  SET search_path = public, extensions;

ALTER FUNCTION public.get_order_charge_amount(public.orders)
  SET search_path = public;

ALTER FUNCTION public.products_sync_price_jpy_from_price()
  SET search_path = public;
