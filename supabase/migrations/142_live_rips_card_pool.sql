-- Live Rips card pool (catalog of pullable cards) + pull snapshot by card_pool_id

CREATE TABLE IF NOT EXISTS public.live_rip_card_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_key text NOT NULL,
  product_id text REFERENCES public.live_rip_products(id) ON DELETE SET NULL,
  name text NOT NULL,
  name_en text,
  rarity text,
  set_code text,
  card_number text,
  image_url text,
  market_value_jpy numeric(14,2),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_rip_card_pool_collection_not_blank CHECK (length(trim(collection_key)) > 0),
  CONSTRAINT live_rip_card_pool_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_live_rip_card_pool_collection_active
  ON public.live_rip_card_pool(collection_key, is_active, name);
CREATE INDEX IF NOT EXISTS idx_live_rip_card_pool_product
  ON public.live_rip_card_pool(product_id);
CREATE INDEX IF NOT EXISTS idx_live_rip_card_pool_name_trgm_fallback
  ON public.live_rip_card_pool(lower(name), lower(COALESCE(name_en, '')));

ALTER TABLE public.live_rip_pulls
  ADD COLUMN IF NOT EXISTS card_pool_id uuid REFERENCES public.live_rip_card_pool(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_rip_pulls_card_pool_id
  ON public.live_rip_pulls(card_pool_id);

DROP TRIGGER IF EXISTS trg_live_rip_card_pool_touch_updated_at ON public.live_rip_card_pool;
CREATE TRIGGER trg_live_rip_card_pool_touch_updated_at
BEFORE UPDATE ON public.live_rip_card_pool
FOR EACH ROW EXECUTE FUNCTION public.live_rips_touch_updated_at();

ALTER TABLE public.live_rip_card_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_rip_card_pool_public_read" ON public.live_rip_card_pool;
CREATE POLICY "live_rip_card_pool_public_read"
  ON public.live_rip_card_pool
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "live_rip_card_pool_admin_manage" ON public.live_rip_card_pool;
CREATE POLICY "live_rip_card_pool_admin_manage"
  ON public.live_rip_card_pool
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_live_rips_upsert_card(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := NULLIF(trim(COALESCE(p_payload->>'id', '')), '')::uuid;
  v_row public.live_rip_card_pool%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.live_rip_card_pool (
      collection_key, product_id, name, name_en, rarity, set_code, card_number,
      image_url, market_value_jpy, is_active, created_by
    ) VALUES (
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'collection_key', '')), ''), 'general'),
      NULLIF(trim(COALESCE(p_payload->>'product_id', '')), ''),
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'name', '')), ''), 'Card'),
      NULLIF(trim(COALESCE(p_payload->>'name_en', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'rarity', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'set_code', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'card_number', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'image_url', '')), ''),
      NULLIF(trim(COALESCE(p_payload->>'market_value_jpy', '')), '')::numeric,
      COALESCE(NULLIF(trim(COALESCE(p_payload->>'is_active', '')), '')::boolean, true),
      auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.live_rip_card_pool
    SET
      collection_key = COALESCE(NULLIF(trim(COALESCE(p_payload->>'collection_key', '')), ''), collection_key),
      product_id = COALESCE(NULLIF(trim(COALESCE(p_payload->>'product_id', '')), ''), product_id),
      name = COALESCE(NULLIF(trim(COALESCE(p_payload->>'name', '')), ''), name),
      name_en = COALESCE(NULLIF(trim(COALESCE(p_payload->>'name_en', '')), ''), name_en),
      rarity = COALESCE(NULLIF(trim(COALESCE(p_payload->>'rarity', '')), ''), rarity),
      set_code = COALESCE(NULLIF(trim(COALESCE(p_payload->>'set_code', '')), ''), set_code),
      card_number = COALESCE(NULLIF(trim(COALESCE(p_payload->>'card_number', '')), ''), card_number),
      image_url = COALESCE(NULLIF(trim(COALESCE(p_payload->>'image_url', '')), ''), image_url),
      market_value_jpy = COALESCE(NULLIF(trim(COALESCE(p_payload->>'market_value_jpy', '')), '')::numeric, market_value_jpy),
      is_active = COALESCE(NULLIF(trim(COALESCE(p_payload->>'is_active', '')), '')::boolean, is_active)
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_search_cards(
  p_query text DEFAULT NULL,
  p_collection_key text DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
  v_query text := lower(NULLIF(trim(COALESCE(p_query, '')), ''));
  v_collection text := NULLIF(trim(COALESCE(p_collection_key, '')), '');
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT c.*
    FROM public.live_rip_card_pool c
    WHERE c.is_active = true
      AND (v_collection IS NULL OR c.collection_key = v_collection)
      AND (
        v_query IS NULL
        OR lower(c.name) LIKE ('%' || v_query || '%')
        OR lower(COALESCE(c.name_en, '')) LIKE ('%' || v_query || '%')
        OR lower(COALESCE(c.rarity, '')) LIKE ('%' || v_query || '%')
        OR lower(COALESCE(c.set_code, '')) LIKE ('%' || v_query || '%')
        OR lower(COALESCE(c.card_number, '')) LIKE ('%' || v_query || '%')
      )
    ORDER BY COALESCE(c.name_en, c.name) ASC
    LIMIT v_limit
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_rips_add_pull(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.live_rip_pulls%ROWTYPE;
  v_card public.live_rip_card_pool%ROWTYPE;
  v_card_pool_id uuid := NULLIF(trim(COALESCE(p_payload->>'card_pool_id', '')), '')::uuid;
  v_card_name text := NULLIF(trim(COALESCE(p_payload->>'card_name', '')), '');
  v_rarity text := NULLIF(trim(COALESCE(p_payload->>'rarity', '')), '');
  v_image_url text := NULLIF(trim(COALESCE(p_payload->>'image_url', '')), '');
  v_market_value numeric := NULLIF(trim(COALESCE(p_payload->>'market_value_jpy', '')), '')::numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_card_pool_id IS NOT NULL THEN
    SELECT *
      INTO v_card
    FROM public.live_rip_card_pool c
    WHERE c.id = v_card_pool_id
      AND c.is_active = true;

    IF v_card.id IS NULL THEN
      RAISE EXCEPTION 'Carta do catálogo não encontrada ou inativa.';
    END IF;

    v_card_name := COALESCE(v_card_name, v_card.name_en, v_card.name);
    v_rarity := COALESCE(v_rarity, v_card.rarity);
    v_image_url := COALESCE(v_image_url, v_card.image_url);
    v_market_value := COALESCE(v_market_value, v_card.market_value_jpy);
  END IF;

  INSERT INTO public.live_rip_pulls (
    event_id,
    reservation_id,
    card_pool_id,
    card_name,
    rarity,
    market_value_jpy,
    image_url,
    pulled_at,
    created_by
  ) VALUES (
    NULLIF(trim(COALESCE(p_payload->>'event_id', '')), '')::uuid,
    NULLIF(trim(COALESCE(p_payload->>'reservation_id', '')), '')::uuid,
    v_card_pool_id,
    COALESCE(v_card_name, 'Card'),
    v_rarity,
    v_market_value,
    v_image_url,
    COALESCE(NULLIF(trim(COALESCE(p_payload->>'pulled_at', '')), '')::timestamptz, now()),
    auth.uid()
  )
  RETURNING * INTO v_row;

  PERFORM public.admin_insert_log(
    'live_rips_pull_add',
    'live_rip_reservation',
    v_row.reservation_id,
    jsonb_build_object(
      'pull_id', v_row.id,
      'card_pool_id', v_row.card_pool_id,
      'card_name', v_row.card_name,
      'rarity', COALESCE(v_row.rarity, '')
    )
  );

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_public_pulls(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_event_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.reservation_id,
      p.card_pool_id,
      p.card_name,
      p.rarity,
      p.market_value_jpy,
      p.image_url,
      p.pulled_at,
      c.name_en AS card_name_en,
      c.collection_key,
      c.set_code,
      c.card_number
    FROM public.live_rip_pulls p
    LEFT JOIN public.live_rip_card_pool c ON c.id = p.card_pool_id
    WHERE p.event_id = v_event_id
    ORDER BY p.pulled_at DESC, p.created_at DESC
    LIMIT 100
  ) t;

  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.service_live_rips_my_pulls(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event_id uuid := COALESCE(p_event_id, public.get_active_live_event_id());
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para visualizar seus pulls.';
  END IF;

  IF v_event_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT
      p.id,
      p.card_pool_id,
      p.card_name,
      p.rarity,
      p.market_value_jpy,
      p.image_url,
      p.pulled_at,
      c.name_en AS card_name_en,
      c.collection_key
    FROM public.live_rip_pulls p
    JOIN public.live_rip_reservations r ON r.id = p.reservation_id
    LEFT JOIN public.live_rip_card_pool c ON c.id = p.card_pool_id
    WHERE r.user_id = v_user_id
      AND r.event_id = v_event_id
    ORDER BY p.pulled_at DESC, p.created_at DESC
  ) t;

  RETURN v_rows;
END;
$$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rip_card_pool';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_live_rips_upsert_card(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_search_cards(text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_live_rips_add_pull(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_public_pulls(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_live_rips_my_pulls(uuid) TO authenticated, service_role;

-- Demo seed (idempotent by name+collection)
INSERT INTO public.live_rip_card_pool (
  collection_key, name, name_en, rarity, set_code, card_number, image_url, market_value_jpy, is_active
)
SELECT * FROM (
  VALUES
    ('pokemon-sv', 'ピカチュウ', 'Pikachu ex', 'RR', 'SV8', '025', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Pikachu+ex', 3500::numeric, true),
    ('pokemon-sv', 'リザードン', 'Charizard ex', 'SAR', 'SV8', '125', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Charizard+ex', 28000::numeric, true),
    ('pokemon-sv', 'ミュウツー', 'Mewtwo ex', 'SR', 'SV8', '150', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Mewtwo+ex', 12000::numeric, true),
    ('pokemon-sv', 'イーブイ', 'Eevee', 'C', 'SV8', '133', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Eevee', 200::numeric, true),
    ('pokemon-sv', 'サーナイト', 'Gardevoir ex', 'SAR', 'SV8', '086', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Gardevoir+ex', 15000::numeric, true),
    ('one-piece-op', 'ルフィ', 'Monkey D. Luffy', 'SEC', 'OP09', '001', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Luffy', 18000::numeric, true),
    ('one-piece-op', 'ゾロ', 'Roronoa Zoro', 'SR', 'OP09', '012', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Zoro', 4500::numeric, true),
    ('one-piece-op', 'ナミ', 'Nami', 'R', 'OP09', '023', 'https://placehold.co/400x560/E8E1D8/4B3A2A?text=Nami', 900::numeric, true)
) AS v(collection_key, name, name_en, rarity, set_code, card_number, image_url, market_value_jpy, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.live_rip_card_pool c
  WHERE c.collection_key = v.collection_key
    AND c.name_en = v.name_en
);
