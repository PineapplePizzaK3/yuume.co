-- Purchase groups (grupo de compras)

CREATE TABLE IF NOT EXISTS public.purchase_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.purchase_groups ENABLE ROW LEVEL SECURITY;

-- Leitura pública (usuários)
DROP POLICY IF EXISTS "Anyone can view active purchase groups" ON public.purchase_groups;
CREATE POLICY "Anyone can view active purchase groups"
  ON public.purchase_groups
  FOR SELECT
  USING (is_active = true);

-- Admin pode gerenciar via RLS (para segurança extra)
DROP POLICY IF EXISTS "Admins can manage purchase groups" ON public.purchase_groups;
CREATE POLICY "Admins can manage purchase groups"
  ON public.purchase_groups
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin: lista grupos
CREATE OR REPLACE FUNCTION public.admin_list_purchase_groups()
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
    SELECT COALESCE(jsonb_agg(row_to_json(g)::jsonb), '[]'::jsonb)
    FROM (
      SELECT *
      FROM public.purchase_groups
      ORDER BY created_at DESC
    ) g
  );
END;
$$;

-- Admin: cria grupo
CREATE OR REPLACE FUNCTION public.admin_create_purchase_group(p_group jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_image_urls jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_image_urls := COALESCE(p_group->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_image_urls) <> 'array' THEN
    v_image_urls := '[]'::jsonb;
  END IF;

  IF (p_group->>'name') IS NULL OR trim(p_group->>'name') = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF jsonb_array_length(v_image_urls) = 0 THEN
    RAISE EXCEPTION 'Fotos (image_urls) são obrigatórias';
  END IF;

  WITH inserted AS (
    INSERT INTO public.purchase_groups (name, description, image_url, image_urls, is_active, updated_at)
    VALUES (
      trim((p_group->>'name'))::text,
      NULLIF(trim(COALESCE(p_group->>'description','')), '')::text,
      (v_image_urls->>0)::text,
      v_image_urls,
      COALESCE((p_group->>'is_active')::boolean, true),
      NOW()
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

