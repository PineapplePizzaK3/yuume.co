-- Add covering indexes for foreign keys flagged by Supabase advisor.
-- Safe/idempotent migration (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_orders_payout_id ON public.affiliate_orders(payout_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_reviewed_by ON public.affiliate_orders(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_approved_by ON public.affiliate_payouts(approved_by);

CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON public.cart_items(variant_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id);

CREATE INDEX IF NOT EXISTS idx_orders_checkout_intent_id ON public.orders(checkout_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON public.orders(coupon_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);
CREATE INDEX IF NOT EXISTS idx_orders_service_id ON public.orders(service_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_address_id ON public.orders(shipping_address_id);

CREATE INDEX IF NOT EXISTS idx_referrals_qualified_order_id ON public.referrals(qualified_order_id);
CREATE INDEX IF NOT EXISTS idx_referrals_reviewed_by ON public.referrals(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_store_checkout_intents_coupon_id ON public.store_checkout_intents(coupon_id);
CREATE INDEX IF NOT EXISTS idx_store_checkout_intents_created_order_id ON public.store_checkout_intents(created_order_id);
CREATE INDEX IF NOT EXISTS idx_store_checkout_intents_referral_id ON public.store_checkout_intents(referral_id);
CREATE INDEX IF NOT EXISTS idx_store_checkout_intents_shipping_address_id ON public.store_checkout_intents(shipping_address_id);

CREATE INDEX IF NOT EXISTS idx_store_products_created_by ON public.store_products(created_by);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON public.system_settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_user_inventory_product_id ON public.user_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON public.wishlist(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_links_user_id ON public.wishlist_links(user_id);
