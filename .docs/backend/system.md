# `system` — health check e status da cadeia de serviços

Rotas de infraestrutura, fora de qualquer módulo de domínio (`backend/src/routes/`).

---

### `GET /health`

- **Autenticação:** público.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ status: 'ok' }`.
- **Erros:** nenhum — se o processo está de pé, responde.
- **Regra:** nenhuma — liveness check do container.

---

### `GET /status`

- **Autenticação:** público.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ backend: 'ok', engine: 'ok' | 'unreachable' }`. Sempre `200`, mesmo se o engine estiver fora do ar — o campo `engine` que reporta o problema.
- **Erros:** nenhum status de erro próprio.
- **Regra:** consulta `GET /health` do motor de simulação via `ENGINE_URL` (`backend/src/infra/engineClient.ts`) e reporta os dois saltos da cadeia — usado pra validar que frontend → gateway → backend → engine está de ponta a ponta funcional (ver tarefa 1.1d do backlog).
