-- Supabase Advisor: RLS Disabled in Public
-- Tabelas afetadas: public.store_products, public.invoice_counters

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active store products" ON public.store_products;
CREATE POLICY "Public can read active store products"
  ON public.store_products
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage store products" ON public.store_products;
CREATE POLICY "Admins can manage store products"
  ON public.store_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage invoice counters" ON public.invoice_counters;
CREATE POLICY "Service role can manage invoice counters"
  ON public.invoice_counters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
