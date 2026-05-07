# Configuração da Plataforma

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição | Onde obter |
|----------|-----------|------------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase | Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Chave anônima (pública) | Supabase Dashboard > Settings > API |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Chave pública Stripe | Stripe Dashboard > API Keys |
| `VITE_API_URL` | Base da API (build) | Pode ficar `/api`; no browser o pagamento usa `/api` no mesmo host por padrão |
| `VITE_PAYMENTS_API_ORIGIN` | (Opcional) API em outro domínio | Só se `/api` não estiver no mesmo site; requer CORS |
| `VITE_SITE_URL` | URL do site em produção | Ex: `https://eiko-dls.com` |

**Apenas no servidor (Vercel Environment Variables):**
- `STRIPE_SECRET_KEY` – nunca exponha no frontend
- `STRIPE_WEBHOOK_SECRET` – para o webhook de pagamento
- `PARCELOW_CLIENT_ID` – Client ID da API Parcelow
- `PARCELOW_CLIENT_SECRET` – Client Secret da API Parcelow
- `PARCELOW_API_BASE_URL` – URL base da API Parcelow (`https://staging.parcelow.com` no staging; sem `/api` no final, a menos que a Parcelow indique)
- `PARCELOW_ORDERS_PATH` – opcional; padrão `POST /api/orders` (moeda USD no JSON; o path `/api/orders/usd` foi descontinuado na API atual)
- `PARCELOW_WEBHOOK_SECRET` – segredo compartilhado opcional para validar webhook Parcelow
- `GLIN_API_KEY` – chave Bearer da Merchant API da Glin
- `GLIN_API_BASE_URL` – URL base da Glin (`https://pay.staging.glin.com.br` em staging; `https://pay.glin.com.br` em produção)
- `GLIN_REMITTANCES_PATH` – opcional; padrão `POST /merchant-api/remittances/`
- `GLIN_WEBHOOK_SECRET` – segredo compartilhado para validar webhook Glin
- `GLIN_FETCH_TIMEOUT_MS` – timeout HTTP opcional para chamadas Glin
- `VITE_GLIN_SDK_ENABLED` – feature flag para preparação do SDK embutido (fase 2)

## Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Habilite **confirmação por email**: Authentication > Providers > Email > marque "Confirm email"
3. No SQL Editor, execute em ordem:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_roles_admin.sql`
   - `supabase/migrations/003_confirm_email_and_profile_trigger.sql`
3. Ative Auth > Providers (Email habilitado por padrão)
4. Configure Site URL e Redirect URLs em Auth > URL Configuration
5. **URLs em inglês (SEO):** o site também expõe autenticação sob `/en/...`. Inclua na lista de **Redirect URLs** (e quaisquer allowlists de OAuth) as variantes em inglês, espelhando as rotas em português, por exemplo:
   - `https://SEU_DOMINIO/en/login`
   - `https://SEU_DOMINIO/en/register`
   - `https://SEU_DOMINIO/en/forgot-password`
   - `https://SEU_DOMINIO/en/reset-password`
   - `https://SEU_DOMINIO/en/app/dashboard` (e demais destinos pós-login que você usar em `redirectTo` / fluxos OAuth)
   O **Site URL** continua sendo a raiz do domínio (ex.: `https://eiko-dls.com`); o que muda é apenas o cadastro das rotas adicionais acima para links de email e provedores sociais não caírem em URL bloqueada.
6. **Conta admin:** cadastre-se em `/register` e depois execute:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'seu-email@exemplo.com';
   ```

## Stripe

1. Crie conta em [stripe.com](https://stripe.com)
2. Em API Keys, use a publishable key no frontend e a secret key no Vercel
3. Configure o webhook em Developers > Webhooks: adicione endpoint para `checkout.session.completed`

## Parcelow

1. Solicite `client_id` e `client_secret` com a equipe Parcelow e cadastre a URL de webhook.
2. Configure no Vercel:
   - `PARCELOW_CLIENT_ID`
   - `PARCELOW_CLIENT_SECRET`
   - `PARCELOW_API_BASE_URL` (staging/produção)
   - `PARCELOW_WEBHOOK_SECRET` (se adotarem segredo compartilhado via header)
3. Configure endpoint de webhook para `POST /api/webhook-parcelow`.
4. Parcelow será priorizado para pedidos BRL/loja; Stripe segue como fallback.

## Glin

1. Gere a `GLIN_API_KEY` no dashboard da Glin (staging/produção com chaves distintas).
2. Configure no Vercel:
   - `GLIN_API_KEY`
   - `GLIN_API_BASE_URL`
   - `GLIN_REMITTANCES_PATH` (opcional)
   - `GLIN_WEBHOOK_SECRET`
3. Configure endpoint de webhook para `POST /api/webhook-glin`.
4. Homologação recomendada em staging:
   - Cartão aprovado: titular `APRO`
   - Cartão rejeitado: titular `OTHE`
   - Cartão pendente: titular `CONT`
   - Fluxo PIX (QR/copia e cola + confirmação)
5. O checkout Redirect da Glin pode ser selecionado na mesma central de pagamentos que Stripe/Parcelow.

## Vercel

1. Conecte o repositório
2. Configure as variáveis de ambiente
3. Deploy – as funções em `api/` serão expostas em `/api/*`
