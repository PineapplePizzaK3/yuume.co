# Live Rips Go-Live Checklist

## A) Banco e permissões
- Rodar migrations `140_live_rips_core.sql`, `141_live_rips_operational_hardening.sql` e `142_live_rips_card_pool.sql`.
- Executar [`scripts/live-rips/rollout-smoke.sql`](../scripts/live-rips/rollout-smoke.sql) e validar:
  - tabelas existem;
  - RPCs existem;
  - tabelas no `supabase_realtime`.
- Validar RLS por perfil:
  - anônimo: só leitura pública (eventos/produtos/fila/pulls);
  - autenticado: própria reserva/pulls e pagamento por wallet;
  - admin: CRUD via RPC admin.

## B) Fluxo crítico (E2E manual)
- Cliente faz login.
- Cliente adiciona créditos na conta.
- Cliente reserva um rip.
- Cliente paga com créditos (wallet-only).
- Reserva entra na fila da live.
- Admin move status até `opening`.
- Admin registra pulls (busca no catálogo de cartas).
- Overlay OBS (`/live-rips/overlay`) mostra o último pull — ver [`live-rips-overlay-obs.md`](./live-rips-overlay-obs.md).
- Admin move status para `cards_logged`.
- Admin finaliza para inventário.
- Cliente vê resultado em `Minha Rip` e no inventário.

## C) Testes de concorrência
- Duplo clique no botão de pagar com wallet.
- Duas abas tentando pagar a mesma reserva.
- Duas reservas simultâneas para o mesmo produto com estoque baixo.
- Mudança de status em paralelo por dois admins.

## D) Operação e observabilidade
- Verificar logs admin para:
  - ajuste de estoque;
  - mudança de status de reserva;
  - criação de pull;
  - finalização para inventário.
- Confirmar fallback de polling quando realtime cair.
- Definir responsável de plantão e runbook de rollback.

## E) Critério de pronto
- Pagamento wallet-only estável (sem débito duplo).
- Fila/pulls atualizam em tempo quase real.
- Operação diária sem editar código/mock.
- Pós-live integrado ao inventário do cliente.
