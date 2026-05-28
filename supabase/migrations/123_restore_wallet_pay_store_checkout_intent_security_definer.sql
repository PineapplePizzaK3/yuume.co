-- Fix wallet store checkout: permission denied for store_intent_materialize_order.
-- Migration 114 switched wallet_pay_store_checkout_intent to SECURITY INVOKER, but this
-- RPC must call internal DEFINER helpers (store_intent_materialize_order, wallet_debit, …)
-- that are not granted to authenticated.

ALTER FUNCTION public.wallet_pay_store_checkout_intent(p_intent_id uuid)
  SECURITY DEFINER;
