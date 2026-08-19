# `system` — health check

Rota de infraestrutura, fora de qualquer pacote de domínio (`engine/internal/infra/httpserver/`). A partir da Semana 2 (motor de renda fixa), cada pacote de domínio novo ganha seu arquivo aqui (ver `.claude/arquitetura-engine-go.md` e o template em `.docs/README.md`) — o primeiro é `account` (tarefa 1.5), documentado em `.docs/engine/account.md`.

---

### `GET /health`

- **Autenticação:** público.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ "status": "ok" }`.
- **Erros:** nenhum — se o processo está de pé, responde.
- **Regra:** nenhuma — liveness check do container, consultado pelo `GET /status` do backend gamificado (ver `.docs/backend/system.md`).
