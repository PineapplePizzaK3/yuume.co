-- Supabase linter hardening:
-- - Reduce exposed SECURITY DEFINER RPC surface
-- - Remove broad SELECT listing policy from public bucket

-- 1) Public bucket listing policy (broad SELECT on storage.objects)
DROP POLICY IF EXISTS "product-images public read" ON storage.objects;

-- 2) Revoke default PUBLIC execute from SECURITY DEFINER functions in public schema
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
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- 3) Keep backend/service access for all SECURITY DEFINER functions
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
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- 4) Re-open only public storefront/landing RPCs for anon
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

-- 5) Re-open authenticated app RPCs actually used by the frontend/app flow
DO $$
DECLARE
  fn RECORD;
  auth_allowed constant text[] := ARRAY[
    'list_store_products',
    'get_public_product_by_id',
    'get_purchase_group_products',
    'mark_notification_read',
    'admin_list_purchase_groups',
    'admin_create_purchase_group',
    'admin_update_purchase_group',
    'admin_delete_purchase_group',
    'admin_create_purchase_group_product',
    'admin_update_purchase_group_product',
    'admin_delete_purchase_group_product',
    'user_request_shipment_quote_to_admin',
    'admin_update_user_inventory',
    'admin_delete_user_inventory',
    'admin_register_package',
    'admin_add_inventory_from_order',
    'admin_set_shipment_freight',
    'admin_set_shipment_shipped',
    'admin_set_shipment_completed',
    'admin_set_shipment_paid',
    'admin_delete_shipment',
    'admin_get_shipping_panel',
    'user_cancel_shipment',
    'admin_orders_with_users',
    'admin_update_order_status',
    'admin_set_shipping_await_payment',
    'admin_update_order',
    'admin_approve_order',
    'admin_set_quote',
    'admin_reject_order',
    'admin_create_order_for_user',
    'admin_delete_order',
    'request_order_extra_services',
    'validate_coupon',
    'admin_insert_log',
    'admin_list_logs',
    'admin_list_user_logs',
    'admin_list_auth_logs',
    'get_or_create_referral_code',
    'bind_referral_on_signup',
    'admin_list_products',
    'admin_list_product_categories',
    'admin_list_store_products',
    'admin_add_product_to_store',
    'admin_remove_product_from_store',
    'admin_create_product',
    'admin_update_product',
    'admin_delete_product',
    'admin_wallet_credit',
    'admin_wallet_debit',
    'create_wallet_topup_request',
    'submit_wallet_topup_comprovante',
    'admin_list_wallet_topup_requests',
    'admin_approve_wallet_topup',
    'admin_reject_wallet_topup',
    'wallet_pay_order',
    'apply_early_prepayment_wallet_jpy',
    'create_store_checkout_intent',
    'wallet_pay_store_checkout_intent',
    'create_store_order',
    'create_store_order_safe',
    'wallet_apply_to_order_jpy',
    'admin_save_system_settings',
    'admin_list_users',
    'admin_get_user_full',
    'admin_update_profile',
    'get_or_create_affiliate',
    'create_affiliate_payout_candidates',
    'admin_process_affiliate_auto_payouts'
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
