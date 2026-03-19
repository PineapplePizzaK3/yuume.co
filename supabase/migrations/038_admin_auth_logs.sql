-- Admin: listar logs de autenticação (registro/login) a partir de auth.audit_log_entries
CREATE OR REPLACE FUNCTION public.admin_list_auth_logs(p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb)
    FROM (
      SELECT
        a.id,
        a.created_at,
        COALESCE(a.payload->>'action', a.payload->>'action_name', '') AS action,
        (a.payload->>'actor_id')::uuid AS user_id,
        COALESCE(
          a.payload->>'actor_username',
          a.payload->>'email',
          a.payload->>'user_email',
          a.payload->'traits'->>'email',
          ''
        ) AS email,
        a.payload AS details
      FROM auth.audit_log_entries a
      WHERE (
        a.payload->>'action' IN ('user_signedup', 'login', 'signup')
        OR a.payload->>'action_name' IN ('user_signedup', 'login', 'signup')
      )
      ORDER BY a.created_at DESC NULLS LAST
      LIMIT LEAST(COALESCE(NULLIF(p_limit, 0), 100), 500)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) r
  );
END;
$$;
