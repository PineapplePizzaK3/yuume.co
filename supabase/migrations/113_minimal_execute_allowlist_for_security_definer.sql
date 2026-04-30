-- Phase 3 hardening:
-- Apply least-privilege EXECUTE grants on SECURITY DEFINER functions in public schema.
-- Strategy:
-- 1) Revoke anon/authenticated from all SECURITY DEFINER functions
-- 2) Grant back only client-facing RPCs required by app/store flows
-- 3) Keep service_role grant for backend/server operations

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- anon: public storefront / landing
DO $$
DECLARE
  fn RECORD;
  anon_allowed constant text[] := ARRAY[
    'list_store_products',
    'get_public_product_by_id',
    'get_purchase_group_products',
    'record_affiliate_click'
  ];
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (anon_allowed)
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- authenticated: user-facing app flows
DO $$
DECLARE
  fn RECORD;
  auth_allowed constant text[] := ARRAY[
    -- storefront
    'list_store_products',
    'get_public_product_by_id',
    'get_purchase_group_products',
    -- notifications and coupon
    'mark_notification_read',
    'validate_coupon',
    -- referral/affiliate user flows
    'get_or_create_referral_code',
    'bind_referral_on_signup',
    'get_or_create_affiliate',
    -- wallet topup / payment
    'create_wallet_topup_request',
    'submit_wallet_topup_comprovante',
    'wallet_pay_order',
    'apply_early_prepayment_wallet_jpy',
    'wallet_apply_to_order_jpy',
    -- store checkout flows (called with user token by backend endpoint)
    'create_store_checkout_intent',
    'wallet_pay_store_checkout_intent',
    'create_store_order',
    'create_store_order_safe',
    -- orders/shipments user actions
    'request_order_extra_services',
    'user_request_shipment_quote_to_admin',
    'user_cancel_shipment',
    'user_set_shipment_freight_self_service'
  ];
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname = ANY (auth_allowed)
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;
