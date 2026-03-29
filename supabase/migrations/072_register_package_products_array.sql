-- Migration 072: Force cleanup and create unified admin_register_package function
-- This explicitly drops all versions by signature before creating the new one.

-- Drop every possible version by full signature
DROP FUNCTION IF EXISTS public.admin_register_package(uuid, text);
DROP FUNCTION IF EXISTS public.admin_register_package(uuid, text, integer);
DROP FUNCTION IF EXISTS public.admin_register_package(uuid, text, integer, numeric);
DROP FUNCTION IF EXISTS public.admin_register_package(uuid, text, integer, numeric, uuid);
DROP FUNCTION IF EXISTS public.admin_register_package(uuid, text, integer, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.admin_register_package(uuid, text, integer, numeric, uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_register_package(uuid, text, integer, numeric, uuid, text, text, jsonb);

-- Create the single unified function
CREATE OR REPLACE FUNCTION public.admin_register_package(
  p_user_id uuid,
  p_products_description text DEFAULT NULL,
  p_items_count integer DEFAULT NULL,
  p_weight_kg numeric DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_products jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  v_pkg RECORD;
  v_description TEXT;
  v_final_items_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_products IS NOT NULL AND jsonb_typeof(p_products) = 'array' AND jsonb_array_length(p_products) > 0 THEN
    v_description := (
      SELECT string_agg(
        COALESCE((item->>'quantity')::text, '1') || 'x ' || COALESCE((item->>'name')::text, 'Produto'),
        '; '
      )
      FROM jsonb_array_elements(p_products) item
    );
    v_final_items_count := (
      SELECT COALESCE(sum(COALESCE((item->>'quantity')::int, 1)), 0)
      FROM jsonb_array_elements(p_products) item
    );
  ELSE
    v_description := p_products_description;
    v_final_items_count := p_items_count;
  END IF;

  INSERT INTO public.user_inventory (
    user_id, order_id, name, products_description, items_count, received_at,
    weight_kg, photo_url, video_url, notes, status
  )
  VALUES (
    p_user_id,
    p_order_id,
    COALESCE(NULLIF(trim(left(v_description, 100)), ''), 'Pacote recebido'),
    NULLIF(trim(v_description), ''),
    COALESCE(v_final_items_count, p_items_count),
    NOW(),
    p_weight_kg,
    NULLIF(trim(p_photo_url), ''),
    NULLIF(trim(p_video_url), ''),
    NULL,
    'stored'
  )
  RETURNING * INTO v_pkg;

  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders SET status = 'completed' WHERE id = p_order_id;
  END IF;

  RETURN to_jsonb(v_pkg);
END;
$$;

-- Final verification
SELECT 
  proname,
  pronargs,
  'SUCCESS: admin_register_package unified with 8 parameters' as status
FROM pg_proc 
WHERE proname = 'admin_register_package';