-- Recompensa de referral ao indicador: após o indicado concluir o envio (não no primeiro pagamento do pedido).

CREATE OR REPLACE FUNCTION public.qualify_referral_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_credit NUMERIC;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.acquisition_mode <> 'referral' OR NEW.referral_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Crédito ao indicador quando o pedido do indicado é enviado ou finalizado.
  IF NEW.status NOT IN ('shipped', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_ref
  FROM public.referrals
  WHERE id = NEW.referral_id
  LIMIT 1;

  IF v_ref.id IS NULL OR v_ref.reward_given THEN
    RETURN NEW;
  END IF;

  v_credit := GREATEST(0, public.get_setting_number('referral_credit_value', 0));

  UPDATE public.referrals
  SET
    status = 'rewarded',
    reward_given = true,
    qualified_order_id = NEW.id,
    qualified_at = NOW(),
    updated_at = NOW()
  WHERE id = v_ref.id
    AND reward_given = false;

  IF FOUND AND v_credit > 0 THEN
    PERFORM public.credit_wallet_referral(
      v_ref.referrer_id,
      v_credit,
      'referral',
      'Recompensa de indicação',
      'order',
      NEW.id,
      jsonb_build_object('referral_id', v_ref.id, 'referred_id', v_ref.referred_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.qualify_referral_on_paid() IS
  'Após UPDATE de orders: se acquisition_mode=referral e status vira shipped/completed, credita o indicador (referral_credit_value).';
