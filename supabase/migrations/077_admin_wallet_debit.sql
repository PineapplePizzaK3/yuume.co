-- Admin: permitir remoção manual de saldo da carteira do usuário.
-- Mantém validações de segurança no backend e usa wallet_debit para registrar extrato.

CREATE OR REPLACE FUNCTION public.admin_wallet_debit(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desc text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  v_desc := COALESCE(NULLIF(trim(p_description), ''), 'Remoção de saldo pelo administrador');

  RETURN public.wallet_debit(
    p_user_id,
    p_amount,
    'adjustment',
    v_desc,
    NULL,
    NULL
  );
END;
$$;

COMMENT ON FUNCTION public.admin_wallet_debit(uuid, numeric, text) IS
  'Admin: remove saldo da carteira do usuário (ajuste manual)';

