-- Código da conta por usuário: nome + código (ex.: "João Silva - ED0001").
-- O destinatário dos envios no Japão será esse nome + código.

-- Coluna e sequência
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_code TEXT;
CREATE SEQUENCE IF NOT EXISTS public.profile_account_code_seq START WITH 1;

-- Backfill: atribuir ED0001, ED0002, ... aos perfis existentes (por data de criação)
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.profiles
  WHERE account_code IS NULL
)
UPDATE public.profiles p
SET account_code = 'ED' || LPAD(o.rn::text, 4, '0')
FROM ordered o
WHERE p.id = o.id;

-- Perfis que já tinham account_code (ou criados após a coluna) não entram no ordered; garantir valor
UPDATE public.profiles
SET account_code = 'ED' || LPAD(nextval('public.profile_account_code_seq')::text, 4, '0')
WHERE account_code IS NULL;

-- Ajustar sequência para o próximo valor livre (evitar duplicata em novos cadastros)
DO $$
DECLARE
  v_max int;
BEGIN
  SELECT max((regexp_replace(account_code, '^ED', ''))::int) INTO v_max FROM public.profiles WHERE account_code ~ '^ED[0-9]+$';
  PERFORM setval('public.profile_account_code_seq', COALESCE(v_max, 0) + 1);
END $$;

-- Restrições
ALTER TABLE public.profiles ALTER COLUMN account_code SET NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_code_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_code_key UNIQUE (account_code);

COMMENT ON COLUMN public.profiles.account_code IS 'Código único da conta (ex: ED0001). Destinatário no Japão = nome + este código.';

-- Trigger: ao criar perfil, preencher account_code com próximo número
CREATE OR REPLACE FUNCTION public.set_profile_account_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.account_code IS NULL OR NEW.account_code = '' THEN
    NEW.account_code := 'ED' || LPAD(nextval('public.profile_account_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_account_code_trigger ON public.profiles;
CREATE TRIGGER set_profile_account_code_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_account_code();

-- Atualizar handle_new_user para não passar account_code (deixar o trigger preencher)
-- O trigger on auth.users insere em profiles; o BEFORE INSERT em profiles agora seta account_code.
-- Como handle_new_user faz INSERT sem account_code, o trigger set_profile_account_code vai preencher.
-- Nada a alterar em handle_new_user se a coluna aceitar NULL no INSERT (o trigger roda BEFORE INSERT e seta NEW.account_code).
-- Como já setamos NOT NULL, o trigger deve preencher. Inserções manuais sem account_code: trigger seta.
-- Inserções pelo handle_new_user: não incluem account_code, então NEW.account_code é NULL e o trigger seta.
-- Precisamos garantir que o trigger rode antes. Está BEFORE INSERT, ok.