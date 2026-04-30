-- Fix admin scheduled purchase-group editor loading.
-- get_purchase_group_products was switched to SECURITY INVOKER in 114, which can
-- break admin/staff field resolution (public.is_admin() path) under hardened grants.
-- Restore only this RPC to SECURITY DEFINER.

ALTER FUNCTION public.get_purchase_group_products(p_group_id uuid)
  SECURITY DEFINER;

ALTER FUNCTION public.get_purchase_group_products(
  p_group_id uuid,
  p_include_staff_fields boolean
)
  SECURITY DEFINER;
