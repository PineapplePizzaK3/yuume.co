-- Resolve remaining "multiple_permissive_policies" warnings by removing
-- admin FOR ALL overlap on read/insert paths that already have user/public policies.

-- coupons: keep authenticated read policy; admin write only.
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can insert coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can update coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can delete coupons" ON public.coupons;

CREATE POLICY "Admins can insert coupons" ON public.coupons
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update coupons" ON public.coupons
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete coupons" ON public.coupons
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- order_items: user owns SELECT/INSERT; admin UPDATE/DELETE only.
DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can delete order items" ON public.order_items;

CREATE POLICY "Admins can update order items" ON public.order_items
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete order items" ON public.order_items
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- purchase_groups: public SELECT already exists; admin write only.
DROP POLICY IF EXISTS "Admins can manage purchase groups" ON public.purchase_groups;
DROP POLICY IF EXISTS "Admins can insert purchase groups" ON public.purchase_groups;
DROP POLICY IF EXISTS "Admins can update purchase groups" ON public.purchase_groups;
DROP POLICY IF EXISTS "Admins can delete purchase groups" ON public.purchase_groups;

CREATE POLICY "Admins can insert purchase groups" ON public.purchase_groups
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update purchase groups" ON public.purchase_groups
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete purchase groups" ON public.purchase_groups
  FOR DELETE
  USING (public.is_admin());

-- shipment_items: user owns SELECT/INSERT; admin UPDATE/DELETE only.
DROP POLICY IF EXISTS "Admins can manage shipment items" ON public.shipment_items;
DROP POLICY IF EXISTS "Admins can update shipment items" ON public.shipment_items;
DROP POLICY IF EXISTS "Admins can delete shipment items" ON public.shipment_items;

CREATE POLICY "Admins can update shipment items" ON public.shipment_items
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete shipment items" ON public.shipment_items
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- shipments: user owns SELECT/INSERT; admin UPDATE/DELETE only.
DROP POLICY IF EXISTS "Admins can manage shipments" ON public.shipments;
DROP POLICY IF EXISTS "Admins can update shipments" ON public.shipments;
DROP POLICY IF EXISTS "Admins can delete shipments" ON public.shipments;

CREATE POLICY "Admins can update shipments" ON public.shipments
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete shipments" ON public.shipments
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- store_products: public SELECT already exists; admin write only.
DROP POLICY IF EXISTS "Admins can manage store products" ON public.store_products;
DROP POLICY IF EXISTS "Admins can insert store products" ON public.store_products;
DROP POLICY IF EXISTS "Admins can update store products" ON public.store_products;
DROP POLICY IF EXISTS "Admins can delete store products" ON public.store_products;

CREATE POLICY "Admins can insert store products" ON public.store_products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update store products" ON public.store_products
  FOR UPDATE
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

CREATE POLICY "Admins can delete store products" ON public.store_products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- system_settings: authenticated SELECT exists; admin write only.
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can insert system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can delete system settings" ON public.system_settings;

CREATE POLICY "Admins can insert system settings" ON public.system_settings
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update system settings" ON public.system_settings
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete system settings" ON public.system_settings
  FOR DELETE
  USING (public.is_admin());

-- user_inventory: user owns SELECT/INSERT; admin UPDATE/DELETE only.
DROP POLICY IF EXISTS "Admins can manage all inventory" ON public.user_inventory;
DROP POLICY IF EXISTS "Admins can update all inventory" ON public.user_inventory;
DROP POLICY IF EXISTS "Admins can delete all inventory" ON public.user_inventory;

CREATE POLICY "Admins can update all inventory" ON public.user_inventory
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete all inventory" ON public.user_inventory
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- products: keep existing SELECT policies (including merged one), admin write only.
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
