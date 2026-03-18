-- Carteira agora trabalha em JPY
ALTER TABLE public.wallets
  ALTER COLUMN currency SET DEFAULT 'JPY';

-- Migrar registros existentes para JPY (se já houver valores)
UPDATE public.wallets
SET currency = 'JPY'
WHERE currency IS DISTINCT FROM 'JPY';

-- Atualiza RPC de crédito para inserir/assumir currency=JPY
CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT DEFAULT 'topup',
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $credit$
DECLARE
  v_balance NUMERIC;
  v_balance_after NUMERIC;
  v_tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor invalido para credito';
  END IF;

  INSERT INTO public.wallets (user_id, balance, currency, updated_at)
  VALUES (p_user_id, 0, 'JPY', NOW())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);
  v_balance_after := v_balance + p_amount;

  UPDATE public.wallets
  SET balance = v_balance_after, currency = 'JPY', updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.wallet_transactions (
    user_id, amount, balance_after, kind, type, description, reference_type, reference_id
  )
  VALUES (
    p_user_id,
    p_amount,
    v_balance_after,
    'credit',
    COALESCE(NULLIF(trim(p_type), ''), 'topup'),
    p_description,
    p_reference_type,
    p_reference_id
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'amount', p_amount,
    'balance_after', v_balance_after,
    'transaction_id', v_tx_id
  );
END;
$credit$;

