-- Profiles: dados pessoais adicionais (CPF/CNPJ e telefone)
-- Necessário para a página "Minha Conta".

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.profiles.cpf_cnpj IS 'CPF ou CNPJ do usuário (texto, pode conter pontuação)';
COMMENT ON COLUMN public.profiles.phone IS 'Telefone do usuário';

