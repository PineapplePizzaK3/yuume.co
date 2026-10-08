-- Store caps are concurrent in-flight slots, not a per-minute rate.
-- Also drop cached all-throttled search payloads so users are not stuck for 10 minutes.

CREATE TABLE IF NOT EXISTS public.store_fetch_inflight (
  store_id text PRIMARY KEY,
  in_flight integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_fetch_inflight ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_fetch_inflight FROM PUBLIC;
GRANT ALL ON TABLE public.store_fetch_inflight TO service_role;

CREATE OR REPLACE FUNCTION public.try_acquire_store_slot(
  p_store_id text,
  p_max integer DEFAULT 2
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store text;
  v_max integer;
  v_until timestamptz;
  v_count integer;
BEGIN
  v_store := lower(trim(COALESCE(p_store_id, '')));
  IF v_store = '' THEN
    RETURN false;
  END IF;
  v_max := GREATEST(1, LEAST(COALESCE(p_max, 2), 8));

  SELECT open_until INTO v_until
  FROM public.store_circuit
  WHERE store_id = v_store;

  IF v_until IS NOT NULL AND v_until > now() THEN
    RETURN false;
  END IF;

  UPDATE public.store_fetch_inflight
  SET in_flight = 0,
      updated_at = now()
  WHERE store_id = v_store
    AND updated_at <= now() - interval '45 seconds';

  INSERT INTO public.store_fetch_inflight (store_id, in_flight, updated_at)
  VALUES (v_store, 1, now())
  ON CONFLICT (store_id) DO UPDATE
    SET in_flight = public.store_fetch_inflight.in_flight + 1,
        updated_at = now()
    WHERE public.store_fetch_inflight.in_flight < v_max
  RETURNING in_flight INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_store_slot(p_store_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store text;
BEGIN
  v_store := lower(trim(COALESCE(p_store_id, '')));
  IF v_store = '' THEN
    RETURN;
  END IF;

  UPDATE public.store_fetch_inflight
  SET in_flight = GREATEST(0, in_flight - 1),
      updated_at = now()
  WHERE store_id = v_store;
END;
$$;

REVOKE ALL ON FUNCTION public.release_store_slot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_store_slot(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_store_slot(text) TO service_role;

-- Unstick anyone already cached as throttled.
DELETE FROM public.search_request_cache
WHERE payload->'partials' @> '[{"reason":"throttled"}]'::jsonb;

TRUNCATE public.store_fetch_window;
UPDATE public.store_circuit SET open_until = NULL, fail_count = 0;
