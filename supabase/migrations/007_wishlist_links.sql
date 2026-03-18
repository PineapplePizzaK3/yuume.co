-- Itens da lista de desejos por link (usuário cola URL)
-- Preço atualizado periodicamente para detectar promoções
-- Executar após 006 (006 = message em orders + trigger OAuth)

CREATE TABLE IF NOT EXISTS wishlist_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price DECIMAL(12,2),
  previous_price DECIMAL(12,2),
  currency TEXT DEFAULT 'JPY',
  image_url TEXT,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wishlist_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist_links" ON wishlist_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wishlist_links" ON wishlist_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wishlist_links" ON wishlist_links
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wishlist_links" ON wishlist_links
  FOR DELETE USING (auth.uid() = user_id);
