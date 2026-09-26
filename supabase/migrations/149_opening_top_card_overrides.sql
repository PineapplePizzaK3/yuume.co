-- Opening top-card overrides
-- Lets admin hide/pin/override automatically scraped cards per collection.

CREATE TABLE IF NOT EXISTS public.opening_top_card_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_key text NOT NULL,
  snkrdunk_id text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  price_jpy_override numeric(14,2),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opening_top_card_overrides_collection_not_blank CHECK (length(trim(collection_key)) > 0),
  CONSTRAINT opening_top_card_overrides_snkrdunk_not_blank CHECK (length(trim(snkrdunk_id)) > 0),
  CONSTRAINT opening_top_card_overrides_price_non_negative CHECK (price_jpy_override IS NULL OR price_jpy_override >= 0),
  CONSTRAINT uq_opening_top_card_overrides UNIQUE (collection_key, snkrdunk_id)
);

CREATE INDEX IF NOT EXISTS idx_opening_top_card_overrides_collection
  ON public.opening_top_card_overrides(collection_key, pinned DESC, updated_at DESC);

DROP TRIGGER IF EXISTS trg_opening_top_card_overrides_touch_updated_at ON public.opening_top_card_overrides;
CREATE TRIGGER trg_opening_top_card_overrides_touch_updated_at
BEFORE UPDATE ON public.opening_top_card_overrides
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.opening_top_card_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opening_top_card_overrides_public_read" ON public.opening_top_card_overrides;
CREATE POLICY "opening_top_card_overrides_public_read"
  ON public.opening_top_card_overrides
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "opening_top_card_overrides_admin_manage" ON public.opening_top_card_overrides;
CREATE POLICY "opening_top_card_overrides_admin_manage"
  ON public.opening_top_card_overrides
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.service_opening_top_card_overrides(
  p_collection_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_collection text := NULLIF(trim(COALESCE(p_collection_key, '')), '');
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_collection IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      o.collection_key,
      o.snkrdunk_id,
      o.hidden,
      o.pinned,
      o.price_jpy_override,
      o.updated_at
    FROM public.opening_top_card_overrides o
    WHERE o.collection_key = v_collection
    ORDER BY o.pinned DESC, o.updated_at DESC
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_opening_upsert_top_card_override(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_collection text := NULLIF(trim(COALESCE(p_payload->>'collection_key', '')), '');
  v_snkrdunk_id text := NULLIF(trim(COALESCE(p_payload->>'snkrdunk_id', '')), '');
  v_hidden boolean := COALESCE(NULLIF(trim(COALESCE(p_payload->>'hidden', '')), '')::boolean, false);
  v_pinned boolean := COALESCE(NULLIF(trim(COALESCE(p_payload->>'pinned', '')), '')::boolean, false);
  v_price numeric(14,2) := NULLIF(trim(COALESCE(p_payload->>'price_jpy_override', '')), '')::numeric;
  v_row public.opening_top_card_overrides%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_collection IS NULL OR v_snkrdunk_id IS NULL THEN
    RAISE EXCEPTION 'collection_key e snkrdunk_id são obrigatórios.';
  END IF;

  INSERT INTO public.opening_top_card_overrides (
    collection_key,
    snkrdunk_id,
    hidden,
    pinned,
    price_jpy_override,
    updated_by
  ) VALUES (
    v_collection,
    v_snkrdunk_id,
    v_hidden,
    v_pinned,
    v_price,
    auth.uid()
  )
  ON CONFLICT (collection_key, snkrdunk_id)
  DO UPDATE SET
    hidden = EXCLUDED.hidden,
    pinned = EXCLUDED.pinned,
    price_jpy_override = EXCLUDED.price_jpy_override,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.service_opening_top_card_overrides(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_opening_upsert_top_card_override(jsonb) TO service_role;
