-- Step 3: verified catalog core (collector-first architecture).
-- catalog_sets / catalog_items are the collectible master, independent of commerce and of scraped marketplaces.
-- Lifecycle: PENDING -> IMPORTED -> VALIDATING -> VERIFIED. Only VERIFIED sets may power completion.
-- All writes go through SECURITY DEFINER functions; tables are public-read.

CREATE TABLE IF NOT EXISTS public.catalog_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise text NOT NULL DEFAULT 'pokemon_tcg' CHECK (franchise ~ '^[a-z0-9_]+$'),
  set_code text NOT NULL CHECK (length(trim(set_code)) > 0),
  name_ja text,
  name_en text,
  release_date date,
  set_kind text NOT NULL DEFAULT 'main'
    CHECK (set_kind IN ('main', 'subset', 'high_class', 'special', 'promo', 'other')),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'IMPORTED', 'VALIDATING', 'VERIFIED')),
  official_reference_url text,
  official_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist_scope jsonb NOT NULL DEFAULT '{"mode": "all_numbers", "exclude_variants": true}'::jsonb,
  import_source text,
  import_ref text,
  imported_at timestamptz,
  validation_report jsonb,
  validated_at timestamptz,
  checklist_version integer NOT NULL DEFAULT 1,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (franchise, set_code)
);

COMMENT ON TABLE public.catalog_sets IS
  'Collectible sets. Only status = VERIFIED may be used for completion/progress. See docs/architecture/collector-platform.md.';
COMMENT ON COLUMN public.catalog_sets.official_manifest IS
  'Facts typed by hand from the official reference page (expected_total, expected_official, optional rarity_counts). Never copied content.';

CREATE TABLE IF NOT EXISTS public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid REFERENCES public.catalog_sets(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'tcg_card' CHECK (kind IN ('tcg_card', 'sealed', 'figure', 'other')),
  franchise text NOT NULL DEFAULT 'pokemon_tcg' CHECK (franchise ~ '^[a-z0-9_]+$'),
  number text,
  number_int integer,
  name_ja text,
  name_en text,
  rarity text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  in_checklist boolean NOT NULL DEFAULT true,
  image_url text,
  image_provenance text NOT NULL DEFAULT 'none'
    CHECK (image_provenance IN ('none', 'own_photo', 'licensed', 'pending_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- D3: no card images unless rights are established.
  CONSTRAINT catalog_items_image_requires_rights
    CHECK (image_url IS NULL OR image_provenance IN ('own_photo', 'licensed'))
);

COMMENT ON COLUMN public.catalog_items.rarity IS
  'Rarity code from a trusted source (official page / manual entry). TCGdex rarity is kept only in attributes.tcgdex_rarity.';

-- One row per printed number within a set; variants (mirror etc.) live in attributes.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_set_number_uniq
  ON public.catalog_items (set_id, number)
  WHERE set_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalog_items_set_number_int_idx ON public.catalog_items (set_id, number_int);
CREATE INDEX IF NOT EXISTS catalog_items_name_ja_idx ON public.catalog_items (lower(name_ja));
CREATE INDEX IF NOT EXISTS catalog_items_name_en_idx ON public.catalog_items (lower(name_en));
CREATE INDEX IF NOT EXISTS catalog_sets_status_idx ON public.catalog_sets (status);

DROP TRIGGER IF EXISTS catalog_sets_touch_updated_at ON public.catalog_sets;
CREATE TRIGGER catalog_sets_touch_updated_at
  BEFORE UPDATE ON public.catalog_sets
  FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

DROP TRIGGER IF EXISTS catalog_items_touch_updated_at ON public.catalog_items;
CREATE TRIGGER catalog_items_touch_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.catalog_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_sets_public_read ON public.catalog_sets;
CREATE POLICY catalog_sets_public_read ON public.catalog_sets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS catalog_items_public_read ON public.catalog_items;
CREATE POLICY catalog_items_public_read ON public.catalog_items FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Demotion: any checklist-relevant change to a VERIFIED set moves it back to VALIDATING.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.catalog_items_demote_verified_set()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_set_ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_set_ids := ARRAY[NEW.set_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_set_ids := ARRAY[OLD.set_id];
  ELSE
    v_set_ids := ARRAY[OLD.set_id, NEW.set_id];
  END IF;

  UPDATE public.catalog_sets
  SET status = 'VALIDATING',
      verified_at = NULL,
      verified_by = NULL,
      validation_report = COALESCE(validation_report, '{}'::jsonb)
        || jsonb_build_object('demoted', jsonb_build_object('at', now(), 'reason', 'checklist_changed', 'op', TG_OP))
  WHERE id = ANY (v_set_ids)
    AND status = 'VERIFIED';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS catalog_items_demote_on_insert_delete ON public.catalog_items;
CREATE TRIGGER catalog_items_demote_on_insert_delete
  AFTER INSERT OR DELETE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.catalog_items_demote_verified_set();

DROP TRIGGER IF EXISTS catalog_items_demote_on_update ON public.catalog_items;
CREATE TRIGGER catalog_items_demote_on_update
  AFTER UPDATE OF number, rarity, in_checklist, set_id ON public.catalog_items
  FOR EACH ROW
  WHEN (
    OLD.number IS DISTINCT FROM NEW.number
    OR OLD.rarity IS DISTINCT FROM NEW.rarity
    OR OLD.in_checklist IS DISTINCT FROM NEW.in_checklist
    OR OLD.set_id IS DISTINCT FROM NEW.set_id
  )
  EXECUTE FUNCTION public.catalog_items_demote_verified_set();

-- ---------------------------------------------------------------------------
-- Internal cores (no grants; called only by the SECURITY DEFINER wrappers below).
-- ---------------------------------------------------------------------------

-- Mirrors normalizeCardNumber() in src/lib/catalog/validateChecklist.js.
CREATE OR REPLACE FUNCTION public.catalog_normalize_number(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_raw IS NULL OR trim(p_raw) = '' THEN NULL
    WHEN trim(split_part(p_raw, '/', 1)) ~ '^[0-9]+$'
      THEN lpad((trim(split_part(p_raw, '/', 1)))::bigint::text, 3, '0')
    ELSE upper(trim(split_part(p_raw, '/', 1)))
  END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_upsert_manifest_core(p_payload jsonb)
RETURNS public.catalog_sets
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_franchise text := COALESCE(NULLIF(trim(v_payload->>'franchise'), ''), 'pokemon_tcg');
  v_set_code text := NULLIF(trim(v_payload->>'set_code'), '');
  v_row public.catalog_sets%ROWTYPE;
  v_old public.catalog_sets%ROWTYPE;
  v_found boolean;
BEGIN
  IF v_payload ? 'id' AND NULLIF(v_payload->>'id', '') IS NOT NULL THEN
    SELECT * INTO v_old FROM public.catalog_sets WHERE id = (v_payload->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Set não encontrado';
    END IF;
  ELSE
    IF v_set_code IS NULL THEN
      RAISE EXCEPTION 'set_code é obrigatório';
    END IF;
    SELECT * INTO v_old FROM public.catalog_sets WHERE franchise = v_franchise AND set_code = v_set_code FOR UPDATE;
  END IF;
  v_found := FOUND;

  IF NOT v_found THEN
    INSERT INTO public.catalog_sets (
      franchise, set_code, name_ja, name_en, release_date, set_kind,
      official_reference_url, official_manifest, checklist_scope, import_source, import_ref
    ) VALUES (
      v_franchise,
      v_set_code,
      NULLIF(trim(v_payload->>'name_ja'), ''),
      NULLIF(trim(v_payload->>'name_en'), ''),
      NULLIF(v_payload->>'release_date', '')::date,
      COALESCE(NULLIF(v_payload->>'set_kind', ''), 'main'),
      NULLIF(trim(v_payload->>'official_reference_url'), ''),
      COALESCE(v_payload->'official_manifest', '{}'::jsonb),
      COALESCE(v_payload->'checklist_scope', '{"mode": "all_numbers", "exclude_variants": true}'::jsonb),
      NULLIF(v_payload->>'import_source', ''),
      NULLIF(v_payload->>'import_ref', '')
    )
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  UPDATE public.catalog_sets SET
    set_code = COALESCE(v_set_code, set_code),
    name_ja = CASE WHEN v_payload ? 'name_ja' THEN NULLIF(trim(v_payload->>'name_ja'), '') ELSE name_ja END,
    name_en = CASE WHEN v_payload ? 'name_en' THEN NULLIF(trim(v_payload->>'name_en'), '') ELSE name_en END,
    release_date = CASE WHEN v_payload ? 'release_date' THEN NULLIF(v_payload->>'release_date', '')::date ELSE release_date END,
    set_kind = COALESCE(NULLIF(v_payload->>'set_kind', ''), set_kind),
    official_reference_url = CASE WHEN v_payload ? 'official_reference_url'
      THEN NULLIF(trim(v_payload->>'official_reference_url'), '') ELSE official_reference_url END,
    official_manifest = COALESCE(v_payload->'official_manifest', official_manifest),
    checklist_scope = COALESCE(v_payload->'checklist_scope', checklist_scope),
    import_source = COALESCE(NULLIF(v_payload->>'import_source', ''), import_source),
    import_ref = COALESCE(NULLIF(v_payload->>'import_ref', ''), import_ref)
  WHERE id = v_old.id
  RETURNING * INTO v_row;

  -- Changing what the checklist is measured against invalidates earlier validation.
  IF v_row.official_manifest IS DISTINCT FROM v_old.official_manifest
     OR v_row.checklist_scope IS DISTINCT FROM v_old.checklist_scope
     OR v_row.official_reference_url IS DISTINCT FROM v_old.official_reference_url
     OR v_row.set_code IS DISTINCT FROM v_old.set_code THEN
    UPDATE public.catalog_sets SET
      status = CASE WHEN status IN ('VALIDATING', 'VERIFIED') THEN 'VALIDATING' ELSE status END,
      validation_report = CASE WHEN status IN ('VALIDATING', 'VERIFIED')
        THEN jsonb_build_object('stale', true, 'reason', 'manifest_changed', 'at', now()) ELSE validation_report END,
      verified_at = NULL,
      verified_by = NULL
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- Upserts items by (set_id, normalized number). Incoming NULLs never erase existing values, so a TCGdex
-- re-import does not wipe rarities or names entered by hand. Returns {inserted, updated, pruned, status}.
CREATE OR REPLACE FUNCTION public.catalog_import_items_core(
  p_set_id uuid,
  p_items jsonb,
  p_source text,
  p_import_ref text,
  p_prune boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_set public.catalog_sets%ROWTYPE;
  v_source text := COALESCE(NULLIF(trim(p_source), ''), 'manual');
  v_inserted integer := 0;
  v_updated integer := 0;
  v_pruned integer := 0;
  v_dupes text;
BEGIN
  SELECT * INTO v_set FROM public.catalog_sets WHERE id = p_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set não encontrado';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Lista de itens vazia';
  END IF;

  CREATE TEMP TABLE _catalog_import ON COMMIT DROP AS
  SELECT
    public.catalog_normalize_number(e->>'number') AS number,
    NULLIF(trim(e->>'name_ja'), '') AS name_ja,
    NULLIF(trim(e->>'name_en'), '') AS name_en,
    NULLIF(upper(trim(e->>'rarity')), '') AS rarity,
    COALESCE(e->'attributes', '{}'::jsonb) AS attributes,
    COALESCE(e->'external_refs', '{}'::jsonb) AS external_refs,
    COALESCE(e->'provenance', '{}'::jsonb) AS provenance,
    CASE WHEN e ? 'in_checklist' THEN (e->>'in_checklist')::boolean ELSE NULL END AS in_checklist,
    COALESCE(NULLIF(e->>'kind', ''), 'tcg_card') AS kind
  FROM jsonb_array_elements(p_items) AS e;

  IF EXISTS (SELECT 1 FROM pg_temp._catalog_import WHERE number IS NULL) THEN
    RAISE EXCEPTION 'Todos os itens precisam de número';
  END IF;

  SELECT string_agg(number, ', ') INTO v_dupes
  FROM (SELECT number FROM pg_temp._catalog_import GROUP BY number HAVING count(*) > 1) d;
  IF v_dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Números duplicados no lote: %', v_dupes;
  END IF;

  UPDATE public.catalog_items ci SET
    name_ja = COALESCE(s.name_ja, ci.name_ja),
    name_en = COALESCE(s.name_en, ci.name_en),
    rarity = COALESCE(s.rarity, ci.rarity),
    attributes = ci.attributes || s.attributes,
    external_refs = ci.external_refs || s.external_refs,
    provenance = ci.provenance || jsonb_build_object(v_source, s.provenance),
    in_checklist = COALESCE(s.in_checklist, ci.in_checklist)
  FROM pg_temp._catalog_import s
  WHERE ci.set_id = p_set_id
    AND ci.number = s.number
    AND (
      ci.name_ja IS DISTINCT FROM COALESCE(s.name_ja, ci.name_ja)
      OR ci.name_en IS DISTINCT FROM COALESCE(s.name_en, ci.name_en)
      OR ci.rarity IS DISTINCT FROM COALESCE(s.rarity, ci.rarity)
      OR ci.attributes IS DISTINCT FROM (ci.attributes || s.attributes)
      OR ci.external_refs IS DISTINCT FROM (ci.external_refs || s.external_refs)
      OR ci.in_checklist IS DISTINCT FROM COALESCE(s.in_checklist, ci.in_checklist)
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.catalog_items (
    set_id, kind, franchise, number, number_int, name_ja, name_en, rarity,
    attributes, external_refs, provenance, in_checklist
  )
  SELECT
    p_set_id,
    s.kind,
    v_set.franchise,
    s.number,
    CASE WHEN s.number ~ '^[0-9]+$' THEN s.number::integer ELSE NULL END,
    s.name_ja,
    s.name_en,
    s.rarity,
    s.attributes,
    s.external_refs,
    jsonb_build_object(v_source, s.provenance),
    COALESCE(s.in_checklist, true)
  FROM pg_temp._catalog_import s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.catalog_items ci WHERE ci.set_id = p_set_id AND ci.number = s.number
  );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF COALESCE(p_prune, false) THEN
    UPDATE public.catalog_items ci SET in_checklist = false
    WHERE ci.set_id = p_set_id
      AND ci.in_checklist
      AND NOT EXISTS (SELECT 1 FROM pg_temp._catalog_import s WHERE s.number = ci.number);
    GET DIAGNOSTICS v_pruned = ROW_COUNT;
  END IF;

  UPDATE public.catalog_sets SET
    status = CASE
      WHEN v_inserted + v_updated + v_pruned > 0 OR status = 'PENDING' THEN 'IMPORTED'
      ELSE status
    END,
    validation_report = CASE WHEN v_inserted + v_updated + v_pruned > 0 THEN NULL ELSE validation_report END,
    validated_at = CASE WHEN v_inserted + v_updated + v_pruned > 0 THEN NULL ELSE validated_at END,
    verified_at = CASE WHEN v_inserted + v_updated + v_pruned > 0 THEN NULL ELSE verified_at END,
    verified_by = CASE WHEN v_inserted + v_updated + v_pruned > 0 THEN NULL ELSE verified_by END,
    import_source = COALESCE(import_source, v_source),
    import_ref = COALESCE(NULLIF(p_import_ref, ''), import_ref),
    imported_at = now()
  WHERE id = p_set_id
  RETURNING * INTO v_set;

  DROP TABLE IF EXISTS pg_temp._catalog_import;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'pruned', v_pruned,
    'status', v_set.status
  );
END;
$$;

-- Stores an automated validation report (see validateChecklist.js). A VERIFIED set stays VERIFIED only if the
-- new report passes with the same spot-check sample; otherwise it goes to VALIDATING and human review restarts.
CREATE OR REPLACE FUNCTION public.catalog_record_validation_core(p_set_id uuid, p_report jsonb)
RETURNS public.catalog_sets
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_set public.catalog_sets%ROWTYPE;
  v_keep_verified boolean;
BEGIN
  SELECT * INTO v_set FROM public.catalog_sets WHERE id = p_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set não encontrado';
  END IF;
  IF v_set.status = 'PENDING' THEN
    RAISE EXCEPTION 'Importe os itens antes de validar';
  END IF;
  IF jsonb_typeof(p_report) IS DISTINCT FROM 'object' OR NOT (p_report ? 'passed') OR NOT (p_report ? 'spot_check') THEN
    RAISE EXCEPTION 'Relatório de validação inválido';
  END IF;

  v_keep_verified := v_set.status = 'VERIFIED'
    AND (p_report->>'passed')::boolean
    AND (p_report->'spot_check'->'item_ids') = (v_set.validation_report->'spot_check'->'item_ids');

  UPDATE public.catalog_sets SET
    status = CASE WHEN v_keep_verified THEN 'VERIFIED' ELSE 'VALIDATING' END,
    validation_report = CASE
      WHEN v_keep_verified THEN p_report || jsonb_build_object('human_review', v_set.validation_report->'human_review')
      ELSE p_report - 'human_review'
    END,
    validated_at = now(),
    verified_at = CASE WHEN v_keep_verified THEN verified_at ELSE NULL END,
    verified_by = CASE WHEN v_keep_verified THEN verified_by ELSE NULL END
  WHERE id = p_set_id
  RETURNING * INTO v_set;

  RETURN v_set;
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_upsert_manifest_core(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_import_items_core(uuid, jsonb, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_record_validation_core(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_items_demote_verified_set() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs (via /api/admin/rpc).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_catalog_upsert_manifest(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN to_jsonb(public.catalog_upsert_manifest_core(p_payload));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_catalog_import_items(
  p_set_id uuid,
  p_items jsonb,
  p_source text DEFAULT 'manual_csv',
  p_prune boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN public.catalog_import_items_core(p_set_id, p_items, p_source, NULL, p_prune);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_catalog_record_validation(p_set_id uuid, p_report jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN to_jsonb(public.catalog_record_validation_core(p_set_id, p_report));
END;
$$;

-- p_review: { "checked": { "<item_id>": true, ... }, "manifest_confirmed": bool, "notes": text }
CREATE OR REPLACE FUNCTION public.admin_catalog_save_review(p_set_id uuid, p_review jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_set public.catalog_sets%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO v_set FROM public.catalog_sets WHERE id = p_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set não encontrado';
  END IF;
  IF v_set.status <> 'VALIDATING' OR v_set.validation_report IS NULL OR NOT (v_set.validation_report ? 'spot_check') THEN
    RAISE EXCEPTION 'A revisão só pode ser salva em um set VALIDATING com relatório';
  END IF;

  UPDATE public.catalog_sets SET
    validation_report = validation_report || jsonb_build_object(
      'human_review', jsonb_build_object(
        'checked', COALESCE(p_review->'checked', '{}'::jsonb),
        'manifest_confirmed', COALESCE((p_review->>'manifest_confirmed')::boolean, false),
        'notes', p_review->>'notes',
        'reviewer', auth.uid(),
        'updated_at', now()
      )
    )
  WHERE id = p_set_id
  RETURNING * INTO v_set;

  RETURN to_jsonb(v_set);
END;
$$;

-- Only VERIFIED (guarded) and VALIDATING (manual demotion) are set by hand; other states come from import/validation.
CREATE OR REPLACE FUNCTION public.admin_catalog_set_status(p_set_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_set public.catalog_sets%ROWTYPE;
  v_report jsonb;
  v_review jsonb;
  v_unchecked integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO v_set FROM public.catalog_sets WHERE id = p_set_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set não encontrado';
  END IF;

  IF p_status = 'VALIDATING' THEN
    IF v_set.status <> 'VERIFIED' THEN
      RAISE EXCEPTION 'Só é possível rebaixar um set VERIFIED';
    END IF;
    UPDATE public.catalog_sets SET
      status = 'VALIDATING',
      verified_at = NULL,
      verified_by = NULL,
      validation_report = COALESCE(validation_report, '{}'::jsonb)
        || jsonb_build_object('demoted', jsonb_build_object('at', now(), 'reason', 'manual', 'note', p_note, 'by', auth.uid()))
    WHERE id = p_set_id
    RETURNING * INTO v_set;
    RETURN to_jsonb(v_set);
  END IF;

  IF p_status <> 'VERIFIED' THEN
    RAISE EXCEPTION 'Status manual inválido: %', p_status;
  END IF;

  v_report := v_set.validation_report;
  v_review := v_report->'human_review';

  IF v_set.status <> 'VALIDATING' THEN
    RAISE EXCEPTION 'O set precisa estar em VALIDATING';
  END IF;
  IF v_report IS NULL OR NOT COALESCE((v_report->>'passed')::boolean, false) THEN
    RAISE EXCEPTION 'A validação automática não passou';
  END IF;
  IF v_set.official_reference_url IS NULL THEN
    RAISE EXCEPTION 'Informe a URL oficial de referência';
  END IF;
  IF v_review IS NULL OR NOT COALESCE((v_review->>'manifest_confirmed')::boolean, false) THEN
    RAISE EXCEPTION 'Confirme o manifesto contra a página oficial';
  END IF;

  SELECT count(*) INTO v_unchecked
  FROM jsonb_array_elements_text(COALESCE(v_report->'spot_check'->'item_ids', '[]'::jsonb)) AS ids(item_id)
  WHERE COALESCE((v_review->'checked'->>ids.item_id)::boolean, false) IS NOT TRUE;
  IF v_unchecked > 0 THEN
    RAISE EXCEPTION 'Faltam % itens na conferência manual', v_unchecked;
  END IF;

  -- D7 grace rule: checklists are only trusted 14 days after release.
  IF v_set.release_date IS NULL OR v_set.release_date > (current_date - 14) THEN
    RAISE EXCEPTION 'Set lançado há menos de 14 dias (ou sem data de lançamento)';
  END IF;

  UPDATE public.catalog_sets SET
    status = 'VERIFIED',
    verified_by = auth.uid(),
    verified_at = now(),
    validation_report = validation_report - 'demoted' - 'stale'
  WHERE id = p_set_id
  RETURNING * INTO v_set;

  RETURN to_jsonb(v_set);
END;
$$;

-- ---------------------------------------------------------------------------
-- Service-role RPCs (scripts/catalog/*.mjs).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.service_catalog_upsert_manifest(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT to_jsonb(public.catalog_upsert_manifest_core(p_payload));
$$;

CREATE OR REPLACE FUNCTION public.service_catalog_import_items(
  p_set_id uuid,
  p_items jsonb,
  p_source text,
  p_import_ref text DEFAULT NULL,
  p_prune boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.catalog_import_items_core(p_set_id, p_items, p_source, p_import_ref, p_prune);
$$;

CREATE OR REPLACE FUNCTION public.service_catalog_record_validation(p_set_id uuid, p_report jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT to_jsonb(public.catalog_record_validation_core(p_set_id, p_report));
$$;

-- Supabase grants EXECUTE to anon/authenticated by default; revoke explicitly.
REVOKE ALL ON FUNCTION public.admin_catalog_upsert_manifest(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_catalog_import_items(uuid, jsonb, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_catalog_record_validation(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_catalog_save_review(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_catalog_set_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_catalog_upsert_manifest(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_catalog_import_items(uuid, jsonb, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_catalog_record_validation(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_catalog_save_review(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_catalog_set_status(uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.service_catalog_upsert_manifest(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_catalog_import_items(uuid, jsonb, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.service_catalog_record_validation(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_catalog_upsert_manifest(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_catalog_import_items(uuid, jsonb, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.service_catalog_record_validation(uuid, jsonb) TO service_role;

-- Rollback (manual; only while no later migration references these tables):
--   DROP FUNCTION IF EXISTS public.service_catalog_record_validation(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.service_catalog_import_items(uuid, jsonb, text, text, boolean);
--   DROP FUNCTION IF EXISTS public.service_catalog_upsert_manifest(jsonb);
--   DROP FUNCTION IF EXISTS public.admin_catalog_set_status(uuid, text, text);
--   DROP FUNCTION IF EXISTS public.admin_catalog_save_review(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.admin_catalog_record_validation(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.admin_catalog_import_items(uuid, jsonb, text, boolean);
--   DROP FUNCTION IF EXISTS public.admin_catalog_upsert_manifest(jsonb);
--   DROP FUNCTION IF EXISTS public.catalog_record_validation_core(uuid, jsonb);
--   DROP FUNCTION IF EXISTS public.catalog_import_items_core(uuid, jsonb, text, text, boolean);
--   DROP FUNCTION IF EXISTS public.catalog_upsert_manifest_core(jsonb);
--   DROP FUNCTION IF EXISTS public.catalog_normalize_number(text);
--   DROP TABLE IF EXISTS public.catalog_items;
--   DROP TABLE IF EXISTS public.catalog_sets;
--   DROP FUNCTION IF EXISTS public.catalog_items_demote_verified_set();
