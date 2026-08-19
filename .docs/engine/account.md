# `account` — abertura de conta com capital inicial padronizado

Pacote: `engine/internal/domain/account/`. Ver `.claude/arquitetura-engine-go.md` pra entender a divisão em domínio/infra — aqui é só o contrato HTTP.

---

### `POST /accounts`

- **Autenticação:** interno — chamado pelo backend gamificado (`ENGINE_URL`), nunca exposto direto ao navegador via gateway.
- **Payload (JSON):** `user_id` — string, UUID do usuário (banco `gamification`), obrigatório.
- **Sucesso:** `201` → `{ user_id, current_balance, total_invested, total_dividends_received }`. `current_balance` sempre `10000.00` (RNF06).
- **Erros:**
  - `400` — `user_id` ausente ou não é um UUID válido.
  - `409` — já existe conta para esse `user_id`.
  - `503` — motor subiu sem `DATABASE_URL` configurado (serviço de contas indisponível).
  - `500` — falha inesperada de persistência.
- **Regra:** `account.Service.Open`. O capital inicial (`account.InitialBalance = 10000.00`) é fixado no domínio, não configurável. Grava o evento imutável `initial_deposit` em `market_events` e só então projeta a linha em `accounts`, na mesma transação (Event Sourcing, CLAUDE.md) — a FK `market_events.user_id → accounts.user_id` é `DEFERRABLE INITIALLY DEFERRED` (migration `000002`) justamente pra permitir essa ordem sem abrir mão da integridade referencial.
