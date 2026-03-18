# Configuração da Plataforma

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição | Onde obter |
|----------|-----------|------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima (pública) | Supabase Dashboard > Settings > API |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Chave pública Stripe | Stripe Dashboard > API Keys |
| `VITE_API_URL` | Base URL da API | Use `/api` para mesmo domínio |
| `VITE_SITE_URL` | URL do site em produção | Ex: `https://seu-site.vercel.app` |

**Apenas no servidor (Vercel Environment Variables):**
- `STRIPE_SECRET_KEY` – nunca exponha no frontend
- `STRIPE_WEBHOOK_SECRET` – para o webhook de pagamento

## Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Habilite **confirmação por email**: Authentication > Providers > Email > marque "Confirm email"
3. No SQL Editor, execute em ordem:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_roles_admin.sql`
   - `supabase/migrations/003_confirm_email_and_profile_trigger.sql`
3. Ative Auth > Providers (Email habilitado por padrão)
4. Configure Site URL e Redirect URLs em Auth > URL Configuration
5. **Conta admin:** cadastre-se em `/register` e depois execute:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'seu-email@exemplo.com';
   ```

## Stripe

1. Crie conta em [stripe.com](https://stripe.com)
2. Em API Keys, use a publishable key no frontend e a secret key no Vercel
3. Configure o webhook em Developers > Webhooks: adicione endpoint para `checkout.session.completed`

## Vercel

1. Conecte o repositório
2. Configure as variáveis de ambiente
3. Deploy – as funções em `api/` serão expostas em `/api/*`
