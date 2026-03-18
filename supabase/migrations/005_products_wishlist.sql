-- Loja virtual: produtos e lista de desejos
-- Executar após 004

-- Produtos da loja (admin cria, usuário vê)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Todos podem ver produtos ativos
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (is_active = true);

-- Admin pode tudo (via service_role ou RLS com role)
-- Para simplificar: policy que permite SELECT a todos. INSERT/UPDATE/DELETE requer role admin.
-- Supabase: criar policy para admin seria via function. Por agora, usuários só SELECT ativos.
-- Admin usará service_role key ou função RPC. Para o frontend com anon key, precisamos de RPC
-- ou policy baseada em profiles.role. Criar policy: INSERT/UPDATE/DELETE where profile.role='admin'
CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Lista de desejos
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist" ON wishlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist" ON wishlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist" ON wishlist
  FOR DELETE USING (auth.uid() = user_id);
