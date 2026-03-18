-- Roles e conta admin
-- Executar no Supabase SQL Editor após 001_initial_schema.sql

-- Adiciona coluna role em profiles (default 'user')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

-- Comentário para referência
COMMENT ON COLUMN profiles.role IS 'user: cliente da plataforma | admin: acesso total para desenvolvimento e gestão';

-- =============================================================================
-- CRIAR CONTA ADMIN
-- =============================================================================
-- 1. Cadastre-se normalmente em /register com o email desejado para admin
-- 2. Execute o comando abaixo trocando 'SEU_EMAIL@exemplo.com' pelo email usado:
--
--    UPDATE profiles SET role = 'admin' WHERE email = 'SEU_EMAIL@exemplo.com';
--
-- 3. Apenas admins podem acessar /app/admin
-- =============================================================================
