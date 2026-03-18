-- Executar após 005
-- 1. Campo de mensagem no pedido
-- 2. Trigger para perfis OAuth (Google/Facebook) receberem o nome corretamente

ALTER TABLE orders ADD COLUMN IF NOT EXISTS message TEXT;

-- Google usa full_name, Facebook usa name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'email', ''), '@', 1),
      ''
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
