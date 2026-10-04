# `admin` — rotas restritas a papel administrativo

Módulo: `backend/src/modules/admin/`. `GET /admin/ping` é rota de exemplo; `POST /admin/macro-events` (tarefa 4.4) e `GET /admin/macro-events` (tarefa 4.5) formam o painel administrativo de Eventos Macro (RF13/RF14, tela 10.1/10.2 do inventário). Outros painéis administrativos chegam na semana 6 e são documentados aqui quando existirem. Desde a tarefa N.4 (Fase N, `backlog-motor-mercado-realista.md`) toda ação mutável do painel grava uma linha em `admin_audit_log` e `GET /admin/audit-log` consulta esse log (seção ao final).

---

### `GET /admin/ping`

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ ok: true }`.
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
- **Regra:** nenhuma regra de negócio própria — existe só pra validar que `shared/http/authMiddleware.ts` (`authenticate` + `requireRole('admin')`) funciona de ponta a ponta. `role: 'admin'` só existe via `npm run db:seed:admin` (`backend/src/db/seed.ts`) — nunca por autocadastro (RNF07, ver `.docs/backend/auth.md`).

### `POST /admin/macro-events`

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** repassado praticamente sem tradução pro motor (mesmos nomes de campo, snake_case) — ver `.docs/engine/macroevent.md` pro formato completo (`template_key` opcional; evento avulso exige `title`/`narrative`/`direction`/`magnitude_band`/`affects_price`/`affects_fundamentals`; `targets`, mínimo 1, cada um com exatamente um entre `sector`/`risk_class`/`asset_id`; `apply_on_day` opcional, inteiro positivo, **agenda** o primeiro dia de efeito pra um dia simulado futuro, N.11). Validado com `interfaces/http/schemas.ts` (`triggerMacroEventBodySchema`, união de duas variantes — template ou avulso) antes de chamar o caso de uso.
- **Sucesso:** `201` → `{ event: {...} }`, corpo de `event` idêntico à resposta de `POST /macro-events` do motor (id, efeitos já amostrados, `fundamentals_report_day` se aplicável, `targets` — array de `{ sector? | risk_class? | asset_id? }` refletindo os alvos persistidos, exatamente um campo preenchido por item).
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — corpo não bate com nenhuma das duas variantes do schema (campo obrigatório ausente, alvo com escopo ambíguo etc.) **ou** o motor rejeitou o evento por uma regra que só ele sabe validar (ex: `template_key` inexistente no catálogo, `asset_id` de alvo que não existe ou não é ação — FII, ETF e renda fixa são recusados — ou `apply_on_day` que não é posterior ao dia simulado corrente ou passa de 365 dias à frente) — dupla validação documentada (Zod na borda + `macroevent.NewEvent`/`NewTarget` no motor), não redundância acidental.
- **Auditoria (N.4):** grava `macro_event.trigger` com `target_type = macro_event`, `target_id` = id do evento criado e `payload` = corpo recebido; `result = failed` com `error_message` quando o motor recusa (`400`). Corpo recusado pelo Zod (`400` antes do caso de uso) não gera linha.
- **Regra:** `TriggerMacroEventUseCase` delega inteiramente pra `MacroEventTrigger` (porta) → `engineMacroEventTrigger` (adapter, chama `POST /macro-events` via `ENGINE_URL`) — a regra de negócio do disparo (sorteio de efeito por banda, defasagem preço↔fundamentos) vive toda no motor; este módulo só garante `role = admin` (RNF07) antes de repassar. Um `400` do motor é traduzido pelo adapter em `InvalidMacroEventError` (`domain/errors.ts`), mapeado de volta pra `400` pelo router — qualquer outra falha do motor (`500`+) propaga como erro genérico (`500`, tratamento padrão do Express).

### `GET /admin/macro-events`

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** query string — `limit` (opcional, inteiro 1–100) e `offset` (opcional, inteiro ≥ 0), validados por `interfaces/http/schemas.ts` (`listMacroEventsQuerySchema`, `z.coerce.number()` já que query chega como string). Ambos repassados como estão pro motor; ausentes, o motor aplica o próprio default (ver `.docs/engine/macroevent.md`). **Filtros do painel (N.11), todos opcionais:** `status` (`pendente` | `aplicado` | `cancelado`), um só entre `sector`, `risk_class` e `asset_id` (UUID), e `from_day`/`to_day` (período em dias simulados do primeiro dia de efeito, `from_day <= to_day`). O router sempre pede ao motor a visão `admin` (enxerga cancelado e agendado); o feed do usuário (`GET /news`) não passa `view` e recebe a visão pública do motor.
- **Sucesso:** `200` → `{ events: [...], total_entries }`, cada item idêntico à resposta de `POST /admin/macro-events` mais `created_at` (mesmo formato de `event`, `targets` incluído) — inclui `status` já atualizado (`pendente`/`aplicado`/`cancelado`), mais `scheduled` (ainda sem efeito aplicado) e `cancellable` (N.11), não um valor congelado da criação (tarefa 4.5: o Temporizador atualiza a coluna a cada tick, ver `.docs/engine/macroevent.md#get-macro-events` e `.docs/engine/tick.md`). `created_at` (tarefa 6.6.1, RFC 3339) só aparece nesta resposta, nunca na de `POST /admin/macro-events` — é o timestamp real de criação, diferente de `triggered_on_day` (dia **simulado**). `total_entries` (tarefa 6.9.9) é o total de eventos macro sem paginação — o motor conta `macro_events` inteira (`SELECT COUNT(*)`) além de aplicar `LIMIT`/`OFFSET`, ver `.docs/engine/macroevent.md#get-macro-events`.
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — `limit`/`offset` fora da faixa aceita (ex: `limit=0`, `limit=101`, `offset=-1`, valor não numérico).
- **Regra:** `ListMacroEventsUseCase` delega inteiramente pra `MacroEventReader` (porta) → `engineMacroEventReader` (adapter, chama `GET /macro-events` via `ENGINE_URL`, repassando `limit`/`offset` como query string) — nenhuma regra de negócio própria, mesmo padrão de delegação fina de `TriggerMacroEventUseCase`. Não expõe patrimônio nem dado de conta de usuário — evento macro é estado global do motor (Mercado Ao Vivo único), não por conta (CLAUDE.md).

### `POST /admin/tick`

*(Gap fechado na tarefa 7.3, `backlog-plataforma-investimentos.md` — até esta tarefa, `POST /admin/tick` só existia na rede interna do Compose, `engine:8080`, nunca alcançável do host nem do gateway; comentário de `handleAdminTick` em `engine/internal/infra/httpserver/admin.go` já antecipava esse proxy "quando o painel admin existir". Sem ele, a suíte e2e não tinha como avançar dias simulados batendo só no gateway — decisão confirmada com o autor em 2026-09-28: criar o proxy em vez de expor a porta do motor ao host ou contornar via `docker exec`.)*

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** nenhum — o motor não aceita parâmetro nenhum nesta rota.
- **Sucesso:** `200` → corpo idêntico ao de `POST /admin/tick` do motor: `{ day, selic_rate, quotes_count, fundamentals_count, is_copom_day, is_report_day, dividends_generated_count, dividends_paid_count, bot_fills_count, expired_orders_count, uncovered_assets_count, intraday_rounds_count }` (ver `.docs/engine/tick.md`).
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `409` — já existe um tick em andamento (trava consultiva do motor, tarefa S.3 — job diário automático ou outro `POST /admin/tick` concorrente).
  - Qualquer outra falha do motor (`500`/`503`) propaga como erro genérico (`500`, tratamento padrão do Express) — mesmo raciocínio de `POST /admin/macro-events` pra falhas fora das traduzidas explicitamente.
- **Auditoria (N.4):** grava `tick.trigger` com `target_type = tick`, `target_id` = dia simulado e `payload = { day }`; `result = failed` com o motivo quando o motor recusa (ex: `409` de tick em andamento).
- **Regra:** `TriggerTickUseCase` delega inteiramente pra `TickTrigger` (porta) → `engineTickTrigger` (adapter, chama `POST /admin/tick` via `ENGINE_URL`, sem body) — nenhuma regra de negócio própria, mesmo padrão de delegação fina das outras duas rotas deste módulo. Serve tanto demonstração ao vivo pra banca quanto a suíte `backend/test/e2e/` (avançar dias simulados sem esperar o job diário real).

### Segurança do painel (tarefa N.22)

Valem para todas as rotas `/admin/*`:

- **Sem cache:** toda resposta leva `Cache-Control: no-store`.
- **Limite de taxa:** 600 requisições por minuto por IP (`429` com `Retry-After`). O painel faz polling, então o teto é folgado; serve pra frear laço descontrolado. Janela fixa em memória (uma instância do backend); com réplicas, migrar o contador pro Redis.
- **Token curto:** token de admin expira em 2 horas (ver `auth.md`).
- **Reautenticação em ação destrutiva:** `POST /admin/tick`, `POST /admin/tick/advance`, `POST /admin/scheduler/pause`, `POST /admin/halts` (pausa de negociação) e `POST /admin/orders/cancel-batch` devolvem `401 { error: "reauth_required" }` se a senha não foi conferida nos últimos 5 minutos (login conta). A checagem vem **depois** do `403` de papel (usuário comum nunca vê `reauth_required`) e **antes** de qualquer efeito ou auditoria. Retomar o temporizador e levantar pausa não são destrutivos e não pedem. Fluxo: `POST /auth/reauth` → token novo → repetir a ação.
- **Auditoria de sessão:** `admin.login`, `admin.login_failed`, `admin.reauth`, `admin.reauth_failed` entram em `admin_audit_log` (`target_type = session`).
- **2FA** fica de fora (Fase 2).

#### Criar e revogar administrador (runbook)

`role = admin` nunca nasce de autocadastro (RNF07). **Criar:** com a stack no ar, `docker compose exec -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e ADMIN_USERNAME=... backend node dist/db/seed.js` (idempotente: e-mail já existente não é alterado). **Revogar:** não há rota nem tela (o painel não promove nem rebaixa `role`, CLAUDE.md); direto no banco, `UPDATE users SET role = 'user' WHERE email = '...'`, e o token antigo morre sozinho em até 2 horas (a revogação imediata de sessão é o "forçar logout" da N.16). Toda ação do admin fica no `admin_audit_log`, que continua consultável depois da revogação.

### `GET /admin/audit-log`

*(Tarefa N.4. Sem backfill: ações administrativas anteriores à tarefa não existem no log.)*

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** query string, todos opcionais, validados por `listAuditLogQuerySchema` (`interfaces/http/schemas.ts`): `admin_id` (uuid), `action` (lista fechada em `domain/auditEntry.ts`: `macro_event.trigger`, `tick.trigger`, `tick.advance`, `scheduler.pause`, `scheduler.resume`, `order.cancel`, `order.cancel_batch`, e as demais da lista fechada, incluindo `admin.login`, `admin.login_failed`, `admin.reauth`, `admin.reauth_failed`, `user.suspend`, `user.reactivate`, `user.force_logout`, `user.delete`), `result` (`success` | `failed`), `from`/`to` (ISO 8601 com fuso, `from` ≤ `to`), `limit` (inteiro 1–100, padrão 20) e `offset` (inteiro ≥ 0, padrão 0).
- **Sucesso:** `200` → `{ entries: [...], total_entries }`, mais recentes primeiro. Cada item: `{ id, admin_id, admin_username, action, target_type, target_id | null, payload, result, error_message | null, occurred_at }`. `total_entries` é o total do filtro, sem paginação.
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — filtro fora do formato (ação desconhecida, uuid inválido, `limit` fora de 1–100, data inválida, intervalo invertido).
- **Regra:** `ListAuditLogUseCase` delega pra `AuditLogRepository` (porta) → `drizzleAuditLogRepository` (`admin_audit_log` com join em `users` pro `admin_username`). Quem grava é `RecordAdminActionUseCase.run`, chamado pelos casos de uso do módulo em volta da operação mutável: registra `success` ou `failed` e devolve ou relança o resultado original. Se a gravação do log falhar, o erro é logado (`[audit]`) e a resposta da ação **não** muda (um tick que já rodou não vira `500`). O log é **append-only também no banco**: o trigger `admin_audit_log_append_only` recusa `UPDATE` e `DELETE` (migration `0018`). `payload` guarda só a entrada da ação, nunca senha, token ou patrimônio absoluto. Toda tarefa nova da Fase N que mude estado deve adicionar sua ação em `ADMIN_AUDIT_ACTIONS` e chamar `run`.

### Gestão de usuários (tarefa N.16)

Seis rotas. Todas exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum). Quem **muda estado** (`suspend`, `force-logout`, `DELETE`) exige também senha conferida há menos de 5 minutos (`401 reauth_required`, N.22) e grava `admin_audit_log` com `target_type = user` e `target_id` = id do usuário (`reactivate` não pede senha: devolve acesso, não tira). O administrador **vê o patrimônio absoluto** de qualquer usuário, sem auditar a leitura (exceção deliberada à RNF09, CLAUDE.md, decisão de 2026-10-03). Não existe rota pra editar perfil de terceiro nem pra mudar `role`. "Solicitar redefinição de senha" ficou de fora: não há canal de e-mail no produto.

#### `GET /admin/users`

- **Payload:** query string, todos opcionais: `q` (nome, e-mail ou username, contém, sem caixa; um UUID também casa o id exato), `role` (`user` | `admin`), `status` (`active` | `suspended`), `provider` (`password` ou o nome de um provedor, hoje `google`), `created_from`/`created_to` (ISO 8601 com fuso, `created_from` ≤ `created_to`), `limit` (1–100, padrão 20), `offset` (≥ 0).
- **Sucesso:** `200` → `{ users: [{ id, name, email, username, role, status, onboarding_completed, providers, created_at }], total }`, cadastro mais recente primeiro. Nunca devolve hash de senha nem token de provedor. `%` e `_` no `q` são literais.
- **Erros:** `400` filtro inválido.

#### `GET /admin/users/:id`

- **Sucesso:** `200` → `{ account, progression, achievements_count, friends_count, portfolio, open_orders, timeline }`. `account`: dados de conta, `status`, `suspended_reason`, `suspended_at`, `providers`, `onboarding_completed`. `progression`: `xp`, `level`, `current_streak`, `longest_streak`, `last_qualifying_activity_date` (a "última atividade"). `portfolio`: `{ cash, variable_income_value, fixed_income_value, net_worth, positions[] }` lido do **saldo atual da conta no motor** (mesma marcação a mercado do ranking), nunca da reconstrução por replay; só posições com quantidade > 0. `open_orders`: `{ total, orders[] }` (até 10, via a mesma consulta do `GET /admin/orders`). `timeline`: até 20 ações do painel sobre esta conta, mais recentes primeiro (inclui as das tarefas seguintes). `portfolio` e `open_orders` vêm `null` se o motor não responder: o resto do detalhe continua.
- **Erros:** `400` id que não é UUID; `404` usuário inexistente.

#### `POST /admin/users/:id/suspend`

- **Payload:** `{ reason }`, 3 a 500 caracteres (obrigatório; vai pro log e pra tela).
- **Sucesso:** `204`. Grava `status = suspended`, `suspended_reason`, `suspended_at` e **revoga as sessões** (um token antigo não volta a valer na reativação). A conta sai do ranking e da busca de amigos, perde o login (`403 account_suspended`) e todo token existente passa a receber `403 account_suspended`; o progresso não é tocado. **Não cancela ordens em repouso** (use `POST /admin/orders/cancel-batch`, N.10). Auditoria: `user.suspend` com `payload.reason`.
- **Erros:** `400` sem motivo; `401 reauth_required`; `404`; `409` conta já suspensa; `422 { code: "admin_account_protected" }` alvo é `admin` (evita se trancar fora).

#### `POST /admin/users/:id/reactivate`

- **Sucesso:** `204`. Volta a `active`, limpa motivo e instante, **sem perda** de progresso, conquistas, amizades ou posições. As sessões antigas continuam encerradas: a pessoa loga de novo. Auditoria: `user.reactivate`.
- **Erros:** `404`; `409` conta que não está suspensa.

#### `POST /admin/users/:id/force-logout`

- **Sucesso:** `204`. Incrementa `users.token_version` (atômico); o `authMiddleware` compara a versão do token com a do banco e devolve `401 sessão encerrada` pra qualquer token emitido antes. A pessoa pode logar de novo. Auditoria: `user.force_logout`.
- **Erros:** `401 reauth_required`; `404`.

#### `DELETE /admin/users/:id`

- **Payload:** `{ confirm_username }`, o username atual da conta digitado de volta (confirmação dupla junto com a senha recente).
- **Sucesso:** `204`. Mesmo caminho do `DELETE /me` (`AnonymizeAccountUseCase`): anonimiza nome, e-mail, username e senha, desconecta os provedores, apaga a foto e **revoga as sessões**; a linha de `users` e o histórico imutável ficam. Auditoria: `user.delete` com **só o id** do alvo, nunca o username.
- **Erros:** `400` sem `confirm_username`; `401 reauth_required`; `404`; `422 { code: "confirmation_mismatch" }` username não confere; `422 { code: "admin_account_protected" }` alvo é `admin`.

### Correções manuais de conta (tarefa N.17)

Ferramentas de suporte sobre um usuário. Todas exigem Bearer token + `role: 'admin'` e, as que **mudam estado**, senha conferida há menos de 5 minutos (`401 reauth_required`, N.22), e gravam `admin_audit_log` com `target_type = user` e `target_id` = id do usuário (aparecem na linha do tempo do detalhe, N.16). Os ajustes de gamificação e de lição exigem `reason` (3 a 500 caracteres); no crédito o motivo é opcional. Cada correção passa pelo caso de uso do módulo dono do dado (gamificação, conquistas, lições), nunca por update direto. **Resetar carteira fica fora** (apagaria histórico imutável e conflita com RNF06): a alternativa é suspender e criar conta nova.

#### `POST /admin/users/:id/credit`

- **Payload:** `{ amount, reason? }`. `amount` é um número positivo e finito (`NaN` e infinito nem existem em JSON); `reason` até 500 caracteres.
- **Sucesso:** `200` → `{ user_id, credited }`, onde `credited` é o valor de fato creditado (o motor arredonda pra centavos). **Sem teto de negócio** (decisão do autor, achado 029 item 5); o único limite é físico (R$ 1 trilhão por crédito, e saldo final dentro de `numeric(15,2)`). O motor grava o evento imutável `admin_credit` antes de somar em `current_balance` (`POST /admin/accounts/{user_id}/credit`, `.docs/engine/account.md`). É caixa livre: não toca `total_invested` e companhia, então **não altera a rentabilidade do ranking**. No extrato aparece com `event_type = "admin_credit"`, nunca como salário. Auditoria: `user.credit` com `amount`, `reason` (se houver) e `credited`.
- **Erros:** `400` valor inválido na borda (zero, negativo, texto, ausente); `401 reauth_required`; `404` usuário inexistente (ou sem conta no motor); `422 { code: "credit_rejected" }` o motor recusou o valor; `422 { code: "balance_overflow" }` o crédito estouraria o saldo.

#### `POST /admin/users/:id/xp`

- **Payload:** `{ delta, reason }`. `delta` é um inteiro diferente de zero, positivo ou negativo.
- **Sucesso:** `200` → `{ xp, level, current_streak, longest_streak }`. O nível é recalculado do XP total (`levelForXp`), então pode subir ou descer mais de um nível, e as conquistas são reavaliadas (best-effort). O total nunca fica abaixo de zero. Auditoria: `user.adjust_xp` com `delta`, `reason` e o `xp`/`level` resultantes.
- **Erros:** `400` payload inválido; `401 reauth_required`; `404`; `422 { code: "invalid_correction" }` tiraria mais XP do que o usuário tem.

#### `POST /admin/users/:id/streak`

- **Payload:** `{ value, reason }`. `value` é um inteiro de 0 a 36500: o novo streak atual.
- **Sucesso:** `200` → mesmo corpo de `/xp`. `longest_streak` só sobe (é o máximo histórico). Um streak maior que zero conta como "vivo hoje" (`last_qualifying_activity_date` = hoje, UTC), senão o próximo toque o reiniciaria em 1; zero limpa essa data. Auditoria: `user.set_streak`.
- **Erros:** `400`; `401 reauth_required`; `404`.

#### `POST /admin/users/:id/achievements/:achievementId/grant` e `/revoke`

- **Payload:** `{ reason }`.
- **Sucesso:** `204`. `grant` concede a conquista **sem checar o critério**; `revoke` remove. Atenção: se o usuário ainda satisfaz o critério, a próxima checagem automática (XP, streak, lição) a concede de novo; revogar só "fica" quando foi dada por engano. Auditoria: `user.grant_achievement` / `user.revoke_achievement` com `achievement_id`, `achievement_name` e `reason`.
- **Erros:** `400` sem motivo ou id que não é UUID; `401 reauth_required`; `404` usuário ou conquista inexistente; `409` o usuário já tem a conquista (`grant`) ou não a tem (`revoke`).

#### `POST /admin/users/:id/lessons/:lessonId/complete` e `/reopen`

- **Payload:** `{ reason }`.
- **Sucesso:** `204`. `complete` grava a conclusão sem passar pelo gate de passos nem de desbloqueio, e **não dá XP**, não toca o streak, não conta pra missão e não vai pro feed (o XP, se devido, é um ajuste separado em `/xp`). `reopen` limpa a conclusão e volta pro passo 0, mantendo a escolha da micro-decisão e o XP já dado; como a progressão conta lições satisfeitas, reabrir uma lição no meio do currículo faz o usuário perder o acesso à última que ela liberou até concluí-la de novo. Auditoria: `user.complete_lesson` / `user.reopen_lesson` com `lesson_id`, `lesson_code` e `reason`.
- **Erros:** `400`; `401 reauth_required`; `404` usuário ou lição inexistente; `409` a lição já está concluída (`complete`) ou não está concluída (`reopen`).

#### `GET /admin/users/:id/corrections`

- **Sucesso:** `200` → `{ achievements: [{ id, name, description, unlocked }], lessons: [{ id, code, title, track_number, status }] }`, o que a tela precisa pra montar os seletores. `status` da lição: `completed` | `in_progress` | `not_started`. Leitura: não audita.
- **Erros:** `400` id que não é UUID; `404`.

### Painel de Tempo (tarefa N.6)

Cinco rotas que repassam o controle do Temporizador do motor (ver `.docs/engine/tick.md#controle-do-temporizador-tarefa-n6-fase-n`). Todas exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum, nada é chamado nem auditado nesses casos). Proxy fino: `SchedulerAdmin` (porta → `engineSchedulerAdmin`) chama o motor via `ENGINE_URL`; a regra (pausa só vale pro tick agendado, retomar não recupera o tempo parado, teto de dias) vive no motor.

#### `GET /admin/scheduler`

- **Sucesso:** `200` → `{ enabled, paused, resumed_at, ticks_per_day, timezone, max_catch_up, next_slot_at, tick_in_progress, last_tick_at }`, idêntico ao do motor. `enabled` é a agenda do processo (variável de ambiente, só leitura); `paused` é a pausa em runtime.

#### `POST /admin/scheduler/pause` e `POST /admin/scheduler/resume`

- **Payload:** nenhum.
- **Sucesso:** `200` → o estado novo (mesmo corpo de `GET /admin/scheduler`). Idempotente.
- **Erros:** `409` — agenda automática desligada neste ambiente (`TICK_SCHEDULER_ENABLED=false`), não há o que pausar.
- **Auditoria:** `scheduler.pause` / `scheduler.resume`, `target_type = scheduler`; a recusa do motor grava `result = failed` com o motivo.

#### `GET /admin/ticks`

- **Payload:** query `limit` (1 a 100) e `offset` (≥ 0), opcionais, validados por `listTicksQuerySchema`.
- **Sucesso:** `200` → `{ ticks: [...], total_entries }`, mais recente primeiro. Cada item: `{ simulated_day | null, trigger ('scheduled' | 'catchup' | 'manual'), status ('success' | 'failed'), error_message | null, started_at, duration_ms, catch_up_discarded, selic_rate | null, is_copom_day, is_report_day, quotes_count, fundamentals_count, dividends_generated_count, dividends_paid_count, bot_fills_count, expired_orders_count, uncovered_assets_count, intraday_rounds_count }`.
- **Erros:** `400` — `limit`/`offset` fora da faixa.

#### `POST /admin/tick/advance`

- **Payload:** `{ "days": N }`, inteiro de 1 a 30 (`advanceTicksBodySchema`, o mesmo teto do motor).
- **Sucesso:** `200` → `{ requested, ticks: [...] }`, um item por tick no formato de `POST /admin/tick`. Os N ticks rodam em sequência no motor sob uma única trava. **Afeta todos os usuários** (o mercado é compartilhado).
- **Erros:** `400` — `days` ausente, fora de 1 a 30, fracionário ou texto (nada é chamado nem auditado); `409` — já existe um tick em andamento; `500` — falha no meio: `{ error, completed_ticks }` com os ticks que **já rodaram** (ficam gravados; não há rollback de mercado).
- **Auditoria:** `tick.advance`, `target_type = tick`, `target_id` = último dia simulado, `payload = { days, executed, last_day }` (uma única linha pro lote inteiro); falha grava `result = failed` com o motivo e `payload = { days }`.
- **Limite conhecido:** a resposta só volta quando todos os dias terminaram (cada tick leva alguns segundos e cresce com o catálogo); o motor dá 2 minutos de prazo de escrita por dia pedido.

### Visão geral e saúde do sistema (tarefa N.5)

Duas rotas de leitura da tela de entrada do painel. Exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum). Só leitura: não passam pela auditoria (N.4).

#### `GET /admin/system/health`

- **Sucesso:** `200` → `{ checked_at, components: [{ key, status, latency_ms | null, detail | null }] }`, sempre nesta ordem: `backend`, `engine`, `gamification_db`, `market_db`, `redis`. `status` é `ok`, `degradado` (respondeu, mas em mais de 1000 ms) ou `fora` (falhou ou não respondeu em 3 s; `latency_ms` vira `null` e `detail` traz o motivo).
- **Erros:** nenhum próprio. Um componente fora **não** derruba a resposta, só aparece como `fora`.
- **Regra:** `GetSystemHealthUseCase` sonda os componentes em paralelo por `HealthProbe` (porta): `engine` = `GET /health` do motor; `gamification_db` = `select 1` no pool do backend; `redis` = `PING`; `market_db` = a leitura da visão geral do motor (só o motor fala com esse banco, então se ela responde o banco está de pé). O `backend` é `ok` por definição.

#### `GET /admin/overview`

- **Sucesso:** `200` → `{ market, scheduler, last_tick, users, errors }`.
  - `market`: o corpo de `GET /admin/overview` do motor (ver `.docs/engine/admin.md`).
  - `scheduler`: o corpo de `GET /admin/scheduler` (agenda ligada/pausada, próximo slot).
  - `last_tick`: a linha mais recente de `GET /admin/ticks`, ou `null` se nunca houve tick.
  - `users`: `{ total, signups_last_24h, signups_last_7d }`, só contas `role = user`.
  - `errors`: por seção que falhou (`market`, `scheduler`, `last_tick`, `users`), a mensagem do erro; vazio quando tudo respondeu.
- **Erros:** nenhum próprio. Uma fonte fora vira `null` na seção dela e a mensagem em `errors`; as demais seguem. A tela de entrada precisa abrir justamente quando algo está quebrado.

### Monitor do mercado ao vivo (tarefa N.8)

Duas rotas de leitura que repassam o monitor do motor (ver `.docs/engine/admin.md`). Exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum). Só leitura: não passam pela auditoria (N.4). Proxy fino: `MarketMonitorReader` (porta) → `engineMarketMonitorReader`; os números (spread, variação, indicador por classe, posse de bots) são calculados no motor. Os indicadores macro (Selic/IPCA) e o calendário da tela reaproveitam as rotas públicas `GET /market/indicators` e `GET /market/calendar`, sem rota nova.

#### `GET /admin/market/assets`

- **Sucesso:** `200` → `{ assets: [...] }`, um item por ativo negociável (ação, ETF, FII), ordenado por ticker, no formato descrito em `.docs/engine/admin.md` (`last_price`, `daily_change_pct`, `best_bid`, `best_ask`, `spread_pct`, `resting_orders`, `bot_resting_orders`, `day_trades`, `day_volume`, `held_by_bots`, `held_by_users`, `covered`, `indicator`...).
- **Erros:** falha do motor propaga como `500`.

#### `GET /admin/market/assets/:id`

- **Payload:** `:id` UUID (validado por `requireUuidParam`).
- **Sucesso:** `200` → o item acima mais `bids`, `asks`, `trades`, `quotes` e `nav_history`.
- **Erros:** `400` — `id` não é UUID (o motor não é chamado); `404` — ativo inexistente ou fora do universo negociável.

### Ordens do book: consulta e cancelamento por intervenção (tarefa N.10)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/admin.md`); o dono da ordem aparece aqui, ao contrário do book público.

#### `GET /admin/orders`

- **Payload:** query opcional validada por `listAdminOrdersQuerySchema`: `user_id`, `asset_id` (UUID), `side` (`buy` | `sell`), `status` (`open` | `pending` | `partially_filled` | `filled` | `cancelled`; `open` junta pending e partially_filled), `from`, `to` (ISO 8601, `from` ≤ `to`), `limit` (1 a 200), `offset` (≥ 0).
- **Sucesso:** `200` → `{ orders: [{ order_id, asset_id, ticker, user_id, is_bot, bot_archetype | null, side, type, quantity, filled_quantity, price, status, cancel_reason | null, simulated_day, created_at }], total }`, mais recentes primeiro.
- **Erros:** `400` — filtro inválido (o motor não é chamado).

#### `POST /admin/orders/:id/cancel`

- **Payload:** nenhum (`id` UUID no caminho).
- **Sucesso:** `204`.
- **Erros:** `400` — `id` não é UUID; `404` — ordem inexistente; `409` — ordem já executada ou cancelada.
- **Regra:** cancela com `cancel_reason = admin`, de qualquer dono. Não há reserva de saldo/posição a devolver (nenhuma ordem em repouso reserva, achado 015) nem evento a emitir.
- **Auditoria:** `order.cancel`, `target_type = order`, `target_id` = id da ordem; a recusa do motor grava `result = failed` com o motivo.

#### `POST /admin/orders/cancel-batch`

- **Payload (JSON):** `asset_id` e/ou `user_id` (UUID); pelo menos um é obrigatório (`cancelOrdersBatchBodySchema`). Com os dois vale a interseção.
- **Sucesso:** `200` → `{ cancelled_count, cancelled_ids }`.
- **Erros:** `400` — corpo inválido ou nenhum filtro; `422` com `{ error, code: "batch_too_large", matched, max }` — o filtro atinge mais que 500 ordens e **nada é cancelado**.
- **Auditoria:** `order.cancel_batch`, `target_type = order`, **uma linha** com `payload = { asset_id | null, user_id | null, cancelled_count, cancelled_ids }`; o lote recusado grava `result = failed` com o filtro.

### Pausa de negociação (tarefa N.9)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/admin.md`, que descreve o que a pausa faz): **não suspende o tick**, ordens em repouso permanecem, ordem nova de usuário e de bot no escopo é recusada.

#### `GET /admin/halts`

- **Sucesso:** `200` → `{ active: [...], recent: [...] }`; cada item `{ id, scope ('global' | 'asset'), asset_id | null, ticker | null, reason, created_by, created_at, lifted_at | null, lifted_by | null }`. `active` são as vigentes (a global primeiro), `recent` as últimas 30 encerradas.

#### `POST /admin/halts`

- **Payload (JSON):** `scope` (`global` | `asset`), `asset_id` (UUID; obrigatório com `asset`, proibido com `global`), `reason` (1 a 200 caracteres, aparado), validados por `pauseTradingBodySchema`. O `admin_id` vem do token, nunca do corpo.
- **Sucesso:** `201` → a pausa criada.
- **Erros:** `400` — corpo inválido (o motor não é chamado) ou recusa do motor (ativo de renda fixa ou sandbox); `404` — ativo inexistente; `409` — já existe pausa vigente nesse escopo.
- **Auditoria:** `trading.halt`, `target_type = trading_halt`, `target_id` = id da pausa, `payload = { scope, asset_id | null, reason }`; a recusa do motor grava `result = failed` com o motivo.

#### `POST /admin/halts/:id/lift`

- **Payload:** nenhum (`id` UUID no caminho).
- **Sucesso:** `200` → a pausa encerrada.
- **Erros:** `400` — `id` não é UUID; `404` — pausa inexistente; `409` — já encerrada.
- **Auditoria:** `trading.resume`, `target_id` = id da pausa, `payload = { scope, asset_id, ticker }`. Retomar não força uma rodada de bots: quem quiser liquidez imediata dispara 1 tick (`POST /admin/tick`).


### Parâmetros de simulação (tarefa N.7)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/admin.md`, que descreve as faixas e o efeito): só `ticks_per_day` e `max_catch_up` são editáveis.

#### `GET /admin/settings`

- **Sucesso:** `200` → `{ editable: [{ key, value, default, min, max, overridden, updated_by, updated_at, version }], read_only: [{ key, value, reason }] }`.

#### `PUT /admin/settings/:key`

- **Payload (JSON):** `value` (inteiro), validado por `updateEngineSettingBodySchema`. O `admin_id` vem do token.
- **Sucesso:** `200` → o mesmo corpo do `GET`, com o valor novo.
- **Erros:** `400` — `value` não é inteiro (o motor não é chamado); `404` — `key` não é editável (o motor não é chamado); `422` — fora da faixa, com a mensagem do motor.
- **Auditoria:** `settings.update`, `target_type = engine_setting`, `target_id` = a chave, `payload = { key, value }`; a recusa do motor grava `result = failed` com o motivo. O valor anterior não vai no payload: está na linha anterior da mesma chave.

#### `DELETE /admin/settings/:key`

- **Sucesso:** `200` → o mesmo corpo do `GET`, com a chave no padrão do ambiente.
- **Erros:** `404` — `key` não é editável.
- **Auditoria:** `settings.reset`, `target_id` = a chave, `payload = { key }`.

### Ciclo de vida do evento macro (tarefa N.11)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/macroevent.md#ciclo-de-vida-do-evento-tarefa-n11`, que descreve os estados e as regras): `pendente → aplicado` ou `pendente → cancelado`. Agendar é o `apply_on_day` de `POST /admin/macro-events`; o filtro do histórico é o de `GET /admin/macro-events`.

#### `GET /admin/macro-events/:id`

- **Payload:** `id` UUID no caminho; `window_days` (query, opcional, inteiro 1–90, padrão 5), validado por `macroEventDetailQuerySchema`.
- **Sucesso:** `200` → o evento no formato da lista mais `created_by`, `current_day`, `report_date` (AAAA-MM-DD do dia do relatório de fundamentos, só se afeta fundamentos), `publicly_visible` (se o usuário já enxerga o evento), `impact` (`{ available, window_days, base_day, end_day, available_on_day, targets: [{ sector | risk_class | asset_id, assets: [{ asset_id, ticker, price_before, price_after, change_pct }], average_change_pct | null }] }`, variação de preço por alvo; `available` só depois de o mercado chegar em `end_day`) e `user_view`, **a versão que o usuário vê hoje** (a regra `redactPending` do módulo de notícias: enquanto o evento está pendente o veredito, a magnitude, os efeitos e os alvos vêm redigidos). `user_view` só vale quando `publicly_visible` é verdadeiro.
- **Erros:** `400` — `id` não é UUID ou `window_days` inválido (o motor não é chamado); `404` — evento inexistente.
- **Auditoria:** leitura, não grava.

#### `DELETE /admin/macro-events/:id`

- **Payload:** nenhum (`id` UUID no caminho).
- **Sucesso:** `200` → `{ event }`, o evento já `cancelado`.
- **Erros:** `400` — `id` não é UUID; `404` — evento inexistente; `409` — o evento já foi aplicado ou cancelado, já começou a produzir efeito, ou há um tick em andamento (a mensagem do motor diz qual).
- **Auditoria:** `macro_event.cancel`, `target_type = macro_event`, `target_id` = id do evento, `payload = { title, triggered_on_day }`; a recusa do motor grava `result = failed` com o motivo.

### Gestão de bots (tarefa N.1)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/admin.md`, que descreve o formato do bot e as regras). Criar e alterar passam pela auditoria (N.4).

#### `GET /admin/bots`

- **Sucesso:** `200` → `{ bots: [...], uncovered_assets: [{ asset_id, ticker }] }` (formato do motor, sem tradução).

#### `POST /admin/bots`

- **Payload (JSON):** validado por `createBotBodySchema`: `archetype` (`ruido` | `market_maker` | `chartista` | `fundamentalista`), `sectors` (valores do motor, ex: `Bancário/Financeiro`), `risk_classes` (`Conservador` | `Sofisticado`), `asset_classes` (`acao` | `etf` | `fii`), `within_scope_pct` (0,85 a 0,90), `knowledge_level` (0 a 1, opcional), `max_position_size_pct` (> 0 até 1), `market_order_preference` (0 a 1), `spread_width_pct` (0 a 0,10), `max_covered_assets` (inteiro positivo, opcional), `initial_cash` (> 0 até 1.000.000.000.000). Listas ausentes valem `[]`.
- **Sucesso:** `201` → o bot criado.
- **Erros:** `400` — corpo inválido (o motor não é chamado) ou recusa de domínio do motor (escopo vazio, `knowledge_level` fora do `fundamentalista`...); `409` — ID já existente.
- **Auditoria:** `bot.create`, `target_type = bot`, `target_id` = id do bot criado, `payload = { archetype, sectors, risk_classes, asset_classes, initial_cash }`; a recusa do motor grava `result = failed` com o motivo.

#### `PATCH /admin/bots/:id`

- **Payload (JSON, pelo menos um campo):** `is_active`, `max_covered_assets`, `covered_asset_ids` (UUIDs; conjunto final de ativos do Market Maker, `[]` tira toda a cobertura) e, a partir da N.15, a personalidade: `sectors`, `risk_classes`, `asset_classes` (cada lista enviada substitui a atual), `within_scope_pct` (0,85 a 0,90), `knowledge_level` (0 a 1, só fundamentalista), `max_position_size_pct` (> 0 até 1), `spread_width_pct` (0 a 0,10), validados por `updateBotBodySchema`. **`market_order_preference` não é editável** (achado 001): o schema o descarta, e um corpo que só traga esse campo é `400` (nenhum campo editável).
- **Sucesso:** `200` → o bot atualizado.
- **Erros:** `400` — `id` não é UUID, corpo inválido ou recusa do motor (bot que não é Market Maker, cobertura acima do teto, ativo não negociável); `404` — bot inexistente; `409` — ativo já coberto por outro Market Maker; `422` com `{ error, code: "batch_too_large", matched, max }` — Market Maker com ordens demais pra cancelar no ativo removido (nada foi tirado).
- **Auditoria:** `bot.update`, `target_type = bot`, `target_id` = id do bot, `payload` com **só os campos pedidos** (`is_active`, `max_covered_assets`, `covered_asset_ids` e os de personalidade, em snake_case); a recusa do motor grava `result = failed` com o motivo.

#### `POST /admin/bots/:id/funding`

- **Payload (JSON, pelo menos um dos dois):** `cash` (> 0 até 1.000.000.000.000) e `holdings` (`[{ asset_id (UUID), quantity (inteiro de 1 a 2.000.000.000) }]`, não vazia quando enviada), validados por `fundBotBodySchema`.
- **Sucesso:** `200` → o bot depois do aporte.
- **Erros:** `400` — `id` não é UUID, corpo inválido (o motor não é chamado) ou recusa do motor (ativo não negociável, sem cotação, sem cotas em circulação, ativo repetido); `404` — bot inexistente; `409` — a posição passaria do total de cotas em circulação do ativo (teto de float).
- **Auditoria:** `bot.fund`, `target_type = bot`, `target_id` = id do bot, `payload = { cash?, holdings?: [{ asset_id, quantity }] }`; a recusa do motor grava `result = failed` com o motivo. O aporte só soma (nunca remove) e entra por evento imutável no motor (ver `.docs/engine/admin.md`).

### Desempenho dos bots (tarefa N.14)

Duas leituras que repassam o motor (formato e regras em `.docs/engine/admin.md`). Exigem `role = admin` (`401` sem token, `403` para usuário comum). Só leitura: não passam pela auditoria.

#### `GET /admin/bots/:id/activity`

- **Payload (query, opcional):** `days` — inteiro de 1 a 365 (padrão do motor: 30), validado por `botActivityQuerySchema`.
- **Sucesso:** `200` → desempenho do bot (patrimônio, P&L, ordens por situação e motivo de cancelamento, taxa de fill, volume, última atividade e, no Market Maker, a cotação atual por ativo).
- **Erros:** `400` — `id` não é UUID ou `days` inválido (o motor não é chamado); `404` — bot inexistente.

#### `GET /admin/bots/summary`

- **Payload (query, opcional):** `idle_days` — inteiro de 1 a 90 (padrão do motor: 3), validado por `botsSummaryQuerySchema`.
- **Sucesso:** `200` → `{ simulated_day, idle_days, active_bots, idle_bots, low_cash_bots, empty_inventory, liquidity, float_concentration }`.
- **Erros:** `400` — `idle_days` inválido.
- **Rota fixa:** declarada antes de qualquer `/admin/bots/:id` no router, pra `summary` não ser lido como id.
