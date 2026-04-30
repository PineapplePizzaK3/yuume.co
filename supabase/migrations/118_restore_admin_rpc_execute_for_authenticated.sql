-- Compatibility fix:
-- Re-enable EXECUTE for authenticated on admin RPCs.
-- Hardening migrations 112/113 revoked these grants, which breaks admin panel
-- flows that call RPCs with an authenticated admin JWT (instead of service_role).
-- Access control remains enforced by role checks inside each function.

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
      AND (
        p.proname LIKE 'admin\_%' ESCAPE '\'
        OR p.proname IN ('create_affiliate_payout_candidates')
      )
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
