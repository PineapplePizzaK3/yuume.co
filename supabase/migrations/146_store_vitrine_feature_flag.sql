-- Temporarily disable the Loja "Vitrine" tab by default.
-- Admins can re-enable via system_settings.store_vitrine_enabled.

INSERT INTO public.system_settings (key, value)
VALUES ('store_vitrine_enabled', jsonb_build_object('enabled', false))
ON CONFLICT (key) DO NOTHING;

-- Public (anon) and authenticated users may read this non-secret feature flag.
DROP POLICY IF EXISTS "Anyone can read store vitrine flag" ON public.system_settings;
CREATE POLICY "Anyone can read store vitrine flag" ON public.system_settings
  FOR SELECT
  USING (key = 'store_vitrine_enabled');
