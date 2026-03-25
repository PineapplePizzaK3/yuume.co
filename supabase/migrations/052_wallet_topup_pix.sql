-- Recarga de carteira via PIX (manual, como pedidos)
-- Usuário solicita, envia comprovante, admin aprova e credita

CREATE TABLE IF NOT EXISTS public.wallet_topup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_jpy NUMERIC(12,2) NOT NULL CHECK (amount_jpy > 0),
  amount_brl NUMERIC(12,2) NOT NULL CHECK (amount_brl > 0),
  comprovante_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wallet_topup_requests_user ON public.wallet_topup_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_topup_requests_status ON public.wallet_topup_requests(status);

ALTER TABLE public.wallet_topup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topup requests" ON public.wallet_topup_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topup requests" ON public.wallet_topup_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending topup requests" ON public.wallet_topup_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all topup requests" ON public.wallet_topup_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update topup requests" ON public.wallet_topup_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RPC: criar solicitação de recarga PIX (amount_brl vindo do frontend para garantir consistência no QR)
CREATE OR REPLACE FUNCTION public.create_wallet_topup_request(
  p_user_id UUID,
  p_amount_jpy NUMERIC,
  p_amount_brl NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount_brl NUMERIC;
  v_request RECORD;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_amount_jpy IS NULL OR p_amount_jpy < 500 OR p_amount_jpy > 500000 THEN
    RAISE EXCEPTION 'Valor deve ser entre ¥500 e ¥500.000';
  END IF;

  v_amount_brl := GREATEST(COALESCE(p_amount_brl, 1)::numeric, 1);

  INSERT INTO public.wallet_topup_requests (user_id, amount_jpy, amount_brl, status)
  VALUES (p_user_id, p_amount_jpy, v_amount_brl, 'pending')
  RETURNING * INTO v_request;

  RETURN to_jsonb(v_request);
END;
$$;

-- RPC: usuário envia comprovante PIX da recarga
CREATE OR REPLACE FUNCTION public.submit_wallet_topup_comprovante(
  p_request_id UUID,
  p_comprovante_url TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_request FROM public.wallet_topup_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_request.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Solicitação não pertence ao usuário';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitação já foi processada';
  END IF;
  IF p_comprovante_url IS NULL OR trim(p_comprovante_url) = '' THEN
    RAISE EXCEPTION 'URL do comprovante é obrigatória';
  END IF;

  UPDATE public.wallet_topup_requests
  SET comprovante_url = trim(p_comprovante_url)
  WHERE id = p_request_id;

  SELECT * INTO v_request FROM public.wallet_topup_requests WHERE id = p_request_id;
  RETURN to_jsonb(v_request);
END;
$$;

-- RPC: admin aprova recarga PIX (credita carteira e marca como concluída)
CREATE OR REPLACE FUNCTION public.admin_approve_wallet_topup(
  p_request_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_request FROM public.wallet_topup_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitação já foi processada';
  END IF;
  IF v_request.comprovante_url IS NULL OR trim(v_request.comprovante_url) = '' THEN
    RAISE EXCEPTION 'Comprovante não foi enviado';
  END IF;

  PERFORM public.wallet_credit(
    v_request.user_id,
    v_request.amount_jpy,
    'topup',
    'Recarga via PIX - solicitação ' || LEFT(p_request_id::text, 8),
    'wallet_topup',
    p_request_id
  );

  UPDATE public.wallet_topup_requests
  SET status = 'completed', processed_at = NOW()
  WHERE id = p_request_id;

  SELECT * INTO v_request FROM public.wallet_topup_requests WHERE id = p_request_id;
  RETURN to_jsonb(v_request);
END;
$$;

-- RPC: admin lista solicitações de recarga (com dados do usuário)
CREATE OR REPLACE FUNCTION public.admin_list_wallet_topup_requests(
  p_status TEXT DEFAULT 'pending'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  amount_jpy NUMERIC,
  amount_brl NUMERIC,
  comprovante_url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.user_id,
    p.name,
    p.email,
    w.amount_jpy,
    w.amount_brl,
    w.comprovante_url,
    w.status,
    w.created_at,
    w.processed_at
  FROM public.wallet_topup_requests w
  LEFT JOIN public.profiles p ON p.id = w.user_id
  WHERE (p_status IS NULL OR trim(p_status) = '' OR w.status = p_status)
  ORDER BY w.created_at DESC;
END;
$$;

-- RPC: admin rejeita recarga
CREATE OR REPLACE FUNCTION public.admin_reject_wallet_topup(
  p_request_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.wallet_topup_requests
  SET status = 'rejected', processed_at = NOW()
  WHERE id = p_request_id AND status = 'pending'
  RETURNING * INTO v_request;

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada';
  END IF;

  RETURN to_jsonb(v_request);
END;
$$;
