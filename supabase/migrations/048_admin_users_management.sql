-- Admin: gestão de usuários - visualizar, editar perfil, adicionar saldo na carteira
-- RPCs para o painel de administração gerenciar usuários

-- RPC: admin obtém dados completos do usuário (perfil, carteira, contagem de pedidos)
CREATE OR REPLACE FUNCTION public.admin_get_user_full(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_wallet jsonb;
  v_orders_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT to_jsonb(p) INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  SELECT jsonb_build_object(
    'balance', COALESCE(w.balance, 0),
    'currency', COALESCE(w.currency, 'JPY'),
    'updated_at', w.updated_at
  ) INTO v_wallet
  FROM public.wallets w
  WHERE w.user_id = p_user_id;

  IF v_wallet IS NULL THEN
    v_wallet := jsonb_build_object('balance', 0, 'currency', 'JPY', 'updated_at', null);
  END IF;

  SELECT COUNT(*)::int INTO v_orders_count
  FROM public.orders
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'wallet', v_wallet,
    'orders_count', v_orders_count
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_user_full(uuid) IS 'Admin: obtém perfil, carteira e contagem de pedidos do usuário';

-- RPC: admin atualiza perfil de outro usuário
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  WITH updated AS (
    UPDATE public.profiles
    SET
      name = CASE WHEN p_updates ? 'name' THEN NULLIF(trim(p_updates->>'name'), '') ELSE name END,
      email = CASE WHEN p_updates ? 'email' THEN NULLIF(trim(p_updates->>'email'), '') ELSE email END,
      cpf_cnpj = CASE WHEN p_updates ? 'cpf_cnpj' THEN NULLIF(trim(p_updates->>'cpf_cnpj'), '') ELSE cpf_cnpj END,
      phone = CASE WHEN p_updates ? 'phone' THEN NULLIF(trim(p_updates->>'phone'), '') ELSE phone END,
      role = CASE WHEN p_updates ? 'role' AND (p_updates->>'role') IN ('user', 'admin') THEN p_updates->>'role' ELSE role END,
      account_code = CASE WHEN p_updates ? 'account_code' THEN NULLIF(trim(p_updates->>'account_code'), '') ELSE account_code END
    WHERE id = p_user_id
    RETURNING *
  )
  SELECT to_jsonb(u) INTO v_result FROM updated u;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.admin_update_profile(uuid, jsonb) IS 'Admin: atualiza dados do perfil de outro usuário';

-- RPC: admin adiciona saldo na carteira do usuário (crédito manual / ajuste)
CREATE OR REPLACE FUNCTION public.admin_wallet_credit(
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

  v_desc := COALESCE(NULLIF(trim(p_description), ''), 'Adição de saldo pelo administrador');

  RETURN public.wallet_credit(
    p_user_id,
    p_amount,
    'adjustment',
    v_desc,
    NULL,
    NULL
  );
END;
$$;

COMMENT ON FUNCTION public.admin_wallet_credit(uuid, numeric, text) IS 'Admin: adiciona saldo na carteira do usuário (ajuste manual)';
