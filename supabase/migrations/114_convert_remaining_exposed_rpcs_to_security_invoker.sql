-- Phase 4: eliminate remaining exposed SECURITY DEFINER warnings
-- by converting still-exposed client-facing RPCs to SECURITY INVOKER.

-- anon-facing storefront RPCs
ALTER FUNCTION public.get_public_product_by_id(p_product_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_purchase_group_products(p_group_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_purchase_group_products(p_group_id uuid, p_include_staff_fields boolean) SECURITY INVOKER;
ALTER FUNCTION public.list_store_products(p_limit integer, p_offset integer) SECURITY INVOKER;
ALTER FUNCTION public.record_affiliate_click(
  p_code text,
  p_session_key text,
  p_source text,
  p_utm jsonb,
  p_ip_hash text,
  p_user_agent_hash text
) SECURITY INVOKER;

-- authenticated user-facing RPCs
ALTER FUNCTION public.apply_early_prepayment_wallet_jpy(p_order_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.bind_referral_on_signup(p_referred_user_id uuid, p_code text) SECURITY INVOKER;
ALTER FUNCTION public.create_store_checkout_intent(
  p_user_id uuid,
  p_ship_immediately boolean,
  p_shipping_cost numeric,
  p_shipping_currency text,
  p_shipping_address_id uuid,
  p_coupon_code text
) SECURITY INVOKER;
ALTER FUNCTION public.create_store_order(p_user_id uuid, p_ship_immediately boolean) SECURITY INVOKER;
ALTER FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean,
  p_shipping_cost numeric,
  p_shipping_currency text
) SECURITY INVOKER;
ALTER FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean,
  p_shipping_cost numeric,
  p_shipping_currency text,
  p_shipping_address_id uuid
) SECURITY INVOKER;
ALTER FUNCTION public.create_store_order(
  p_user_id uuid,
  p_ship_immediately boolean,
  p_shipping_cost numeric,
  p_shipping_currency text,
  p_shipping_address_id uuid,
  p_coupon_code text
) SECURITY INVOKER;
ALTER FUNCTION public.create_store_order_safe(
  p_user_id uuid,
  p_ship_immediately boolean,
  p_shipping_cost numeric,
  p_shipping_currency text,
  p_shipping_address_id uuid,
  p_coupon_code text
) SECURITY INVOKER;
ALTER FUNCTION public.create_wallet_topup_request(p_user_id uuid, p_amount_jpy numeric) SECURITY INVOKER;
ALTER FUNCTION public.get_or_create_affiliate(p_user_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_or_create_referral_code(p_user_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.mark_notification_read(p_notification_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.request_order_extra_services(p_order_id uuid, p_extra_services jsonb) SECURITY INVOKER;
ALTER FUNCTION public.submit_wallet_topup_comprovante(p_request_id uuid, p_comprovante_url text) SECURITY INVOKER;
ALTER FUNCTION public.user_cancel_shipment(p_shipment_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.user_request_shipment_quote_to_admin(p_user_id uuid, p_inventory_ids uuid[]) SECURITY INVOKER;
ALTER FUNCTION public.user_set_shipment_freight_self_service(
  p_user_id uuid,
  p_shipment_id uuid,
  p_shipping_cost numeric,
  p_currency text
) SECURITY INVOKER;
ALTER FUNCTION public.validate_coupon(p_code text, p_subtotal_brl numeric) SECURITY INVOKER;
ALTER FUNCTION public.wallet_apply_to_order_jpy(
  p_order_id uuid,
  p_user_id uuid,
  p_total_amount_jpy numeric,
  p_amount_jpy numeric
) SECURITY INVOKER;
ALTER FUNCTION public.wallet_pay_order(p_order_id uuid, p_user_id uuid) SECURITY INVOKER;
ALTER FUNCTION public.wallet_pay_store_checkout_intent(p_intent_id uuid) SECURITY INVOKER;
