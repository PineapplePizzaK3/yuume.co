# Funções da Plataforma

Área autenticada para usuários dos serviços: **Redirecionamento**, **Personal Shopping** e **Loja Virtual**.

---

## Papéis (Roles)

| Role | Descrição | Acesso |
|------|-----------|--------|
| **user** | Cliente – usuário dos serviços | Dashboard, Serviços, Pedidos, Pagamentos, Perfil |
| **admin** | Administrador – desenvolvimento e gestão | Todo o acesso de user + área Admin |

---

## Funções por Serviço

### 1. Redirecionamento
- **Redirecionamento Padrão** — você compra nas lojas e envia para nosso endereço (taxa por quantidade de itens).
- **Redirecionamento Assistido** — você envia a lista; nós orçamos e compramos com pré-pagamento (15% + ¥500/item).
- Cadastrar e obter endereço no Japão
- Registrar pacotes recebidos
- Consolidar pedidos
- Solicitar envio internacional
- Acompanhar status de pedidos e fretes

### 2. Personal Shopping
- Enviar lista de compras
- Acompanhar análise e compras
- Aprovar itens
- Receber produtos consolidados
- Pagar taxas e fretes
- Taxa de referência: **25% sobre o valor da compra + ¥200 por item** (+ frete), conforme orçamento enviado pelo admin

### 3. Grupo de Compras
- Comprar produtos dos grupos pelo carrinho
- Taxa: **20% sobre o subtotal dos itens do grupo + ¥200 por unidade** (conversão da parte fixa usa a cotação `fx_brl_per_jpy` nas configurações)

### 4. Loja Virtual (Curadoria)
- Navegar seleções
- Adicionar ao carrinho
- Fazer pedido
- Acompanhar entrega

---

## Fluxo de Pedidos (Redirecionamento / Personal Shopping)

1. **Solicitado** – Usuário envia pedido de produtos
2. **Pagamento do pedido recebido** – Cliente paga o pedido (taxa de serviço)
3. **Produtos recebidos** – Empresa recebe os produtos no armazém (aqui podem ser oferecidos serviços extras)
4. **Consolidado** – Após o cliente pedir o envio: consolidamos o pedido e calculamos o frete conforme o peso da caixa final
5. **Aguardando pagamento do frete** – Frete definido; cliente paga o frete
6. **Frete pago** – Cliente pagou o frete
7. **Enviado** – Pedido enviado ao cliente

Resumo: **Pedido → Pagamento do pedido → Recebimento (serviços extras) → Cliente pede envio → Consolidamos e definimos frete → Cliente paga frete → Enviamos.**

---

## Área do Usuário (Cliente)

| Página | Rota | Descrição |
|--------|------|-----------|
| Dashboard | `/app/dashboard` | Visão geral, atalhos |
| Serviços | `/app/services` | Ver e solicitar serviços |
| Pedidos | `/app/orders` | Histórico e status |
| Pagamentos | `/app/payments` | Pagamentos realizados |
| Perfil | `/app/profile` | Dados da conta |

---

## Área Admin

| Página | Rota | Descrição |
|--------|------|-----------|
| Admin | `/app/admin` | Painel de desenvolvimento e gestão |

*Acesso restrito a perfis com `role = 'admin'`.*

---

## Fluxo de Onboarding

1. Usuário se cadastra em `/register`
2. Perfil criado com `role = 'user'`
3. Primeiro admin: cadastrar em `/register` e executar no Supabase:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'admin@seusite.com';
   ```
