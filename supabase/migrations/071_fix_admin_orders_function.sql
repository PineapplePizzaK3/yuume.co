-- Migration 071: Fix function overload ambiguity for admin_orders_with_users
-- This replaces both previous versions with a single, clean function definition.

-- Drop existing versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.admin_orders_with_users(integer, integer);
DROP FUNCTION IF EXISTS public.admin_orders_with_users(integer, integer, text[]);

-- Create the definitive version
CREATE OR REPLACE FUNCTION public.admin_orders_with_users(
  p_limit INT DEFAULT 1000,
  p_offset INT DEFAULT 0,
  p_status_filter TEXT[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(NULLIF(p_limit, 0), 1000), 1), 5000);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  -- Security check
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(o)::jsonb), '[]'::jsonb)
    FROM (
      SELECT 
        o.*,
        s.name AS service_name,
        p.name AS user_name,
        p.email AS user_email
      FROM public.orders o
      LEFT JOIN public.services s ON s.id = o.service_id
      LEFT JOIN public.profiles p ON p.id = o.user_id
      WHERE (
        p_status_filter IS NULL 
        OR p_status_filter = '{}'::TEXT[] 
        OR o.status = ANY(p_status_filter)
      )
      ORDER BY o.created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) o
  );
END;
$$;

COMMENT ON FUNCTION public.admin_orders_with_users(INT, INT, TEXT[]) IS 
'Admin orders list with optional multi-status filter. 
p_status_filter = NULL or empty array = all statuses.';

-- Verify
SELECT 
  proname,
  pronargs,
  proargnames,
  'Function updated successfully' as status
FROM pg_proc 
WHERE proname = 'admin_orders_with_users';