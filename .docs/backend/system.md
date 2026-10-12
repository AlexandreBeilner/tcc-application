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

### `GET /health/ready`

- **Autenticação:** público (para o monitor externo de uptime). Limite de 60 requisições por minuto por IP.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ status: 'ok', checks: { <nome>: 'ok' } }`.
- **Erros:** `503` → `{ status: 'falhou', checks: { <nome>: 'ok' | 'fail' } }` quando qualquer verificação falha (ou `{ status: 'falhou' }` se a avaliação em si quebrar). Só nomes e `ok`/`fail`: nunca mensagem de erro, endereço interno nem dado de usuário; o detalhe vai para o log (`readiness: falhando (...)`). `429` acima do limite.
- **Verificações (`checks`):** `backend`, `engine`, `gamification_db`, `market_db`, `redis` (falha se estiver `fora`; latência alta não falha); `email_outbox` (falha se a fila estiver parada ou com muitas falhas); `job:<nome>` para cada agendador do backend (falha se ficou mais de 3 intervalos sem sucesso ou falhou 3 vezes seguidas: `payroll`, `ranking`, `email-outbox`, `email-engagement`, `billing-reconciliation`, `funnel-retention`, `duels`, `retrospectives`, `assemblies`); `market_tick` (falha se o Temporizador do motor está ligado, sem pausa, e o último tick tem mais de 2 intervalos + 30 min; ausente quando pausado, desligado, sem tick ainda ou motor indisponível).
- **Regra:** reaproveita `GetSystemHealthUseCase` e `GetSchedulerStatusUseCase` (as sondas do painel admin); o resultado é guardado por 10 s. **Não** é o healthcheck do Docker (esse é `/health`): um job atrasado não pode reiniciar o contêiner em laço. Cada resposta leva o cabeçalho `X-Request-Id` quando `LOG_FORMAT=json`.

---

### `GET /status`

- **Autenticação:** público.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ backend: 'ok', engine: 'ok' | 'unreachable' }`. Sempre `200`, mesmo se o engine estiver fora do ar — o campo `engine` que reporta o problema.
- **Erros:** nenhum status de erro próprio.
- **Regra:** consulta `GET /health` do motor de simulação via `ENGINE_URL` (`backend/src/infra/engineClient.ts`) e reporta os dois saltos da cadeia — usado pra validar que frontend → gateway → backend → engine está de ponta a ponta funcional (ver tarefa 1.1d do backlog).
