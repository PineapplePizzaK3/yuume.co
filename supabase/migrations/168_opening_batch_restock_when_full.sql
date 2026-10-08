-- When a Box Break sells out, keep that box waiting for the opening and
-- put a new box of the same product on sale. Admins get an action notification.

CREATE OR REPLACE FUNCTION public.opening_batch_restock_when_full()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_seq integer := 2;
  v_new_id uuid;
  v_product_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'FULL' OR OLD.status IS NOT DISTINCT FROM 'FULL' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('collector_opening_restock_' || NEW.product_id));

  IF NOT EXISTS (
    SELECT 1
    FROM public.opening_batches b
    WHERE b.product_id = NEW.product_id
      AND b.id <> NEW.id
      AND b.status = 'OPEN'
  ) THEN
    LOOP
      v_code := 'BB-' || NEW.product_id || '-' || v_seq::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.opening_batches b WHERE b.code = v_code
      );
      v_seq := v_seq + 1;
      IF v_seq > 500 THEN
        RAISE EXCEPTION 'Não foi possível abrir a próxima caixa.';
      END IF;
    END LOOP;

    INSERT INTO public.opening_batches (
      code,
      product_id,
      game,
      total_positions,
      price_per_position_jpy,
      status,
      notes
    ) VALUES (
      v_code,
      NEW.product_id,
      NEW.game,
      NEW.total_positions,
      NEW.price_per_position_jpy,
      'OPEN',
      'Próxima caixa da coleção. A caixa anterior esgotou e aguarda abertura.'
    )
    RETURNING id INTO v_new_id;
  END IF;

  SELECT COALESCE(NULLIF(trim(p.name_en), ''), NULLIF(trim(p.name), ''), NEW.product_id)
    INTO v_product_name
  FROM public.live_rip_products p
  WHERE p.id = NEW.product_id;

  PERFORM public.notify_admins_action_required(
    'admin_box_break_full',
    'Caixa de Box Break esgotada',
    COALESCE(v_product_name, NEW.code) || ' esgotou e está aguardando abertura. Uma nova caixa da mesma coleção já está à venda.',
    jsonb_build_object(
      'batch_id', NEW.id,
      'batch_code', NEW.code,
      'product_id', NEW.product_id,
      'product_name', v_product_name,
      'next_batch_id', v_new_id,
      'total_positions', NEW.total_positions
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opening_batches_restock_when_full ON public.opening_batches;
CREATE TRIGGER trg_opening_batches_restock_when_full
AFTER UPDATE OF status ON public.opening_batches
FOR EACH ROW
WHEN (NEW.status = 'FULL' AND OLD.status IS DISTINCT FROM 'FULL')
EXECUTE FUNCTION public.opening_batch_restock_when_full();

COMMENT ON FUNCTION public.opening_batch_restock_when_full() IS
  'Ao esgotar uma caixa, abre a próxima da mesma coleção e avisa os admins.';
