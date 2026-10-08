-- Step 6/8/12 feature flags + Step 8 order catalog links.
-- Flags default to false so production UI stays unchanged until explicitly enabled.

INSERT INTO public.system_settings (key, value) VALUES
  ('collector_home_v2_enabled', jsonb_build_object('enabled', false)),
  ('collector_market_enabled', jsonb_build_object('enabled', false)),
  ('collector_recommendations_enabled', jsonb_build_object('enabled', false)),
  ('module_openings_enabled', jsonb_build_object('enabled', true)),
  ('module_live_rips_enabled', jsonb_build_object('enabled', true))
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can read collector feature flags" ON public.system_settings;
CREATE POLICY "Anyone can read collector feature flags" ON public.system_settings
  FOR SELECT
  USING (key IN (
    'collector_home_v2_enabled',
    'collector_market_enabled',
    'collector_recommendations_enabled',
    'module_openings_enabled',
    'module_live_rips_enabled',
    'store_vitrine_enabled'
  ));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wishlist_item_id uuid REFERENCES public.wishlist_items(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.catalog_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_catalog_item_id_idx ON public.orders (catalog_item_id) WHERE catalog_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_wishlist_item_id_idx ON public.orders (wishlist_item_id) WHERE wishlist_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_catalog_item_id_idx ON public.order_items (catalog_item_id) WHERE catalog_item_id IS NOT NULL;

COMMENT ON COLUMN public.orders.catalog_item_id IS
  'Optional link to a catalog item for personal-shopping / Find in Japan sourcing requests.';

-- Rollback:
--   ALTER TABLE public.order_items DROP COLUMN IF EXISTS catalog_item_id;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS wishlist_item_id;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS catalog_item_id;
--   DELETE FROM public.system_settings WHERE key IN (
--     'collector_home_v2_enabled','collector_market_enabled','collector_recommendations_enabled',
--     'module_openings_enabled','module_live_rips_enabled');
