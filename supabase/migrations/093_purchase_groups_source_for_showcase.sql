-- Purchase groups source: separates Scheduled Buying and Showcase.

ALTER TABLE public.purchase_groups
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'scheduled';

ALTER TABLE public.purchase_groups
  DROP CONSTRAINT IF EXISTS purchase_groups_source_check;

ALTER TABLE public.purchase_groups
  ADD CONSTRAINT purchase_groups_source_check
  CHECK (source IN ('scheduled', 'showcase'));

COMMENT ON COLUMN public.purchase_groups.source IS
  'Origem do grupo: scheduled (Compras Programadas) ou showcase (Vitrine).';

CREATE INDEX IF NOT EXISTS idx_purchase_groups_source_created_at
  ON public.purchase_groups(source, created_at DESC);

-- Admin: create group with source.
CREATE OR REPLACE FUNCTION public.admin_create_purchase_group(p_group jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_image_urls jsonb;
  v_product_ids jsonb;
  v_source text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_image_urls := COALESCE(p_group->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_image_urls) <> 'array' THEN
    v_image_urls := '[]'::jsonb;
  END IF;

  v_product_ids := COALESCE(p_group->'product_ids', '[]'::jsonb);
  IF jsonb_typeof(v_product_ids) <> 'array' THEN
    v_product_ids := '[]'::jsonb;
  END IF;

  v_source := LOWER(COALESCE(NULLIF(trim(p_group->>'source'), ''), 'scheduled'));
  IF v_source NOT IN ('scheduled', 'showcase') THEN
    RAISE EXCEPTION 'Source inválido';
  END IF;

  IF (p_group->>'name') IS NULL OR trim(p_group->>'name') = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF jsonb_array_length(v_image_urls) = 0 THEN
    RAISE EXCEPTION 'Fotos (image_urls) são obrigatórias';
  END IF;

  WITH inserted AS (
    INSERT INTO public.purchase_groups (name, description, image_url, image_urls, is_active, product_ids, source, updated_at)
    VALUES (
      trim((p_group->>'name'))::text,
      NULLIF(trim(COALESCE(p_group->>'description','')), '')::text,
      (v_image_urls->>0)::text,
      v_image_urls,
      COALESCE((p_group->>'is_active')::boolean, true),
      v_product_ids,
      v_source,
      NOW()
    )
    RETURNING *
  )
  SELECT to_jsonb(i) INTO v_result FROM inserted i;
  RETURN v_result;
END;
$$;

-- Admin: update group with source.
CREATE OR REPLACE FUNCTION public.admin_update_purchase_group(p_id uuid, p_group jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_image_urls jsonb;
  v_product_ids jsonb;
  v_source text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_image_urls := COALESCE(p_group->'image_urls', '[]'::jsonb);
  IF jsonb_typeof(v_image_urls) <> 'array' THEN
    v_image_urls := '[]'::jsonb;
  END IF;

  v_product_ids := COALESCE(p_group->'product_ids', '[]'::jsonb);
  IF jsonb_typeof(v_product_ids) <> 'array' THEN
    v_product_ids := '[]'::jsonb;
  END IF;

  v_source := LOWER(COALESCE(NULLIF(trim(p_group->>'source'), ''), 'scheduled'));
  IF v_source NOT IN ('scheduled', 'showcase') THEN
    RAISE EXCEPTION 'Source inválido';
  END IF;

  IF (p_group->>'name') IS NULL OR trim(p_group->>'name') = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF jsonb_array_length(v_image_urls) = 0 THEN
    RAISE EXCEPTION 'Fotos (image_urls) são obrigatórias';
  END IF;

  WITH updated AS (
    UPDATE public.purchase_groups
    SET
      name = trim((p_group->>'name'))::text,
      description = NULLIF(trim(COALESCE(p_group->>'description','')), '')::text,
      image_url = (v_image_urls->>0)::text,
      image_urls = v_image_urls,
      is_active = COALESCE((p_group->>'is_active')::boolean, true),
      product_ids = v_product_ids,
      source = v_source,
      updated_at = NOW()
    WHERE id = p_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  RETURN v_result;
END;
$$;
