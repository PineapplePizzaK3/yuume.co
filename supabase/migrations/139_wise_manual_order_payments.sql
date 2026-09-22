-- Wise manual payments for orders/freight with receipt + admin approval

CREATE TABLE IF NOT EXISTS public.wise_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_jpy NUMERIC(12,2) NOT NULL CHECK (amount_jpy > 0),
  wise_pay_url TEXT NOT NULL,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  admin_note TEXT,
  payment_reference TEXT,
  submitted_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wise_payment_requests_user_created
  ON public.wise_payment_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wise_payment_requests_status_created
  ON public.wise_payment_requests(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wise_payment_requests_one_active_per_order
  ON public.wise_payment_requests(order_id)
  WHERE status IN ('pending', 'submitted');

ALTER TABLE public.wise_payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wise payment requests" ON public.wise_payment_requests;
CREATE POLICY "Users can view own wise payment requests"
  ON public.wise_payment_requests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pending wise payment requests" ON public.wise_payment_requests;
CREATE POLICY "Users can update own pending wise payment requests"
  ON public.wise_payment_requests
  FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('pending', 'submitted'))
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'submitted'));

DROP POLICY IF EXISTS "Users can insert own wise payment requests" ON public.wise_payment_requests;
CREATE POLICY "Users can insert own wise payment requests"
  ON public.wise_payment_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all wise payment requests" ON public.wise_payment_requests;
CREATE POLICY "Admins can view all wise payment requests"
  ON public.wise_payment_requests
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update wise payment requests" ON public.wise_payment_requests;
CREATE POLICY "Admins can update wise payment requests"
  ON public.wise_payment_requests
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Storage policy for receipt upload path:
-- product-images/wise-comprovantes/{user_id}/...
DROP POLICY IF EXISTS "Users can upload wise comprovante" ON storage.objects;
CREATE POLICY "Users can upload wise comprovante" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'wise-comprovantes'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.submit_wise_payment_receipt(
  p_request_id UUID,
  p_receipt_url TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.wise_payment_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF p_receipt_url IS NULL OR trim(p_receipt_url) = '' THEN
    RAISE EXCEPTION 'URL do comprovante é obrigatória';
  END IF;

  SELECT * INTO v_req
  FROM public.wise_payment_requests
  WHERE id = p_request_id;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação Wise não encontrada';
  END IF;
  IF v_req.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Solicitação não pertence ao usuário';
  END IF;
  IF v_req.status NOT IN ('pending', 'submitted') THEN
    RAISE EXCEPTION 'Solicitação já processada';
  END IF;

  UPDATE public.wise_payment_requests
  SET
    receipt_url = trim(p_receipt_url),
    status = 'submitted',
    submitted_at = NOW()
  WHERE id = p_request_id;

  SELECT * INTO v_req FROM public.wise_payment_requests WHERE id = p_request_id;

  PERFORM public.notify_admins_action_required(
    'admin_order_wise_receipt',
    'Comprovante Wise recebido',
    'Pedido ' || LEFT(v_req.order_id::text, 8) || '… recebeu comprovante de transferência Wise.',
    jsonb_build_object(
      'wise_request_id', v_req.id,
      'order_id', v_req.order_id,
      'user_id', v_req.user_id,
      'amount_jpy', v_req.amount_jpy
    )
  );

  RETURN to_jsonb(v_req);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_wise_payment_requests(
  p_status TEXT DEFAULT 'submitted'
)
RETURNS TABLE (
  id UUID,
  order_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  amount_jpy NUMERIC,
  wise_pay_url TEXT,
  receipt_url TEXT,
  status TEXT,
  admin_note TEXT,
  payment_reference TEXT,
  submitted_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.order_id,
    r.user_id,
    p.name,
    p.email,
    r.amount_jpy,
    r.wise_pay_url,
    r.receipt_url,
    r.status,
    r.admin_note,
    r.payment_reference,
    r.submitted_at,
    r.processed_at,
    r.created_at
  FROM public.wise_payment_requests r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE (
    p_status IS NULL
    OR trim(p_status) = ''
    OR r.status = p_status
  )
  ORDER BY COALESCE(r.submitted_at, r.created_at) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_wise_payment_request(
  p_request_id UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.wise_payment_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.wise_payment_requests
  SET
    status = 'rejected',
    admin_note = NULLIF(trim(COALESCE(p_admin_note, '')), ''),
    processed_at = NOW(),
    processed_by = auth.uid()
  WHERE id = p_request_id
    AND status IN ('pending', 'submitted')
  RETURNING * INTO v_req;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação Wise não encontrada ou já processada';
  END IF;

  RETURN to_jsonb(v_req);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_wise_payment_request(
  p_request_id UUID,
  p_transaction_id TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.wise_payment_requests%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment_id TEXT;
  v_new_status TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_req
  FROM public.wise_payment_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação Wise não encontrada';
  END IF;
  IF v_req.status NOT IN ('pending', 'submitted') THEN
    RAISE EXCEPTION 'Solicitação Wise já processada';
  END IF;
  IF COALESCE(trim(v_req.receipt_url), '') = '' THEN
    RAISE EXCEPTION 'Comprovante Wise não foi enviado';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_req.order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido relacionado não encontrado';
  END IF;
  IF v_order.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Pedido não está aguardando pagamento';
  END IF;

  v_payment_id := NULLIF(trim(COALESCE(p_transaction_id, '')), '');
  IF v_payment_id IS NULL THEN
    v_payment_id := 'wise_manual_' || LEFT(v_req.id::text, 12);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE stripe_payment_id = v_payment_id
      AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Identificador de pagamento Wise já utilizado';
  END IF;

  INSERT INTO public.payments (order_id, stripe_payment_id, status, amount, currency)
  VALUES (v_order.id, v_payment_id, 'completed', v_req.amount_jpy, 'JPY');

  v_new_status := CASE
    WHEN v_order.order_source = 'store' AND COALESCE(v_order.ship_immediately, false) THEN 'products_paid'
    ELSE 'paid'
  END;

  UPDATE public.orders
  SET status = v_new_status
  WHERE id = v_order.id
    AND status = 'awaiting_payment';

  UPDATE public.wise_payment_requests
  SET
    status = 'approved',
    admin_note = NULLIF(trim(COALESCE(admin_note, '')), ''),
    payment_reference = v_payment_id,
    processed_at = NOW(),
    processed_by = auth.uid()
  WHERE id = p_request_id
  RETURNING * INTO v_req;

  RETURN to_jsonb(v_req) || jsonb_build_object('order_status', v_new_status);
END;
$$;
