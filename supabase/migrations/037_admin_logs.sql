-- Admin activity logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity ON public.admin_logs(entity_type, entity_id);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver logs
CREATE POLICY "Admins can view admin logs"
  ON public.admin_logs
  FOR SELECT
  USING (public.is_admin());

-- Apenas admins podem inserir logs (via RPC)
CREATE POLICY "Admins can insert admin logs"
  ON public.admin_logs
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Admin: inserir log
CREATE OR REPLACE FUNCTION public.admin_insert_log(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_admin_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_admin_id := auth.uid();

  INSERT INTO public.admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (v_admin_id, p_action, p_entity_type, p_entity_id, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Admin: listar logs
CREATE OR REPLACE FUNCTION public.admin_list_logs(p_limit INT DEFAULT 100, p_offset INT DEFAULT 0)
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
    SELECT COALESCE(jsonb_agg(row_to_json(l)::jsonb), '[]'::jsonb)
    FROM (
      SELECT l.id, l.admin_id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
             p.name AS admin_name, p.email AS admin_email
      FROM public.admin_logs l
      LEFT JOIN public.profiles p ON p.id = l.admin_id
      ORDER BY l.created_at DESC
      LIMIT LEAST(COALESCE(NULLIF(p_limit, 0), 100), 500)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) l
  );
END;
$$;
