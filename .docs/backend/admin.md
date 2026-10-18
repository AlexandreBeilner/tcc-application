# `admin` — rotas restritas a papel administrativo

Módulo: `backend/src/modules/admin/`. `GET /admin/ping` é rota de exemplo; `POST /admin/macro-events` (tarefa 4.4) e `GET /admin/macro-events` (tarefa 4.5) formam o painel administrativo de Eventos Macro (RF13/RF14, tela 10.1/10.2 do inventário). O painel do Diário (`/admin/daily`, DI.5.1) está documentado em `daily.md`. Outros painéis administrativos chegam na semana 6 e são documentados aqui quando existirem. Desde a tarefa N.4 (Fase N, `backlog-motor-mercado-realista.md`) toda ação mutável do painel grava uma linha em `admin_audit_log` e `GET /admin/audit-log` consulta esse log (seção ao final).

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
- **Payload:** repassado praticamente sem tradução pro motor (mesmos nomes de campo, snake_case) — ver `.docs/engine/macroevent.md` pro formato completo (`template_key` opcional; evento avulso exige `title`/`narrative`/`direction`/`magnitude_band`/`affects_price`/`affects_fundamentals`; `targets`, mínimo 1, cada um com exatamente um entre `sector`/`risk_class`/`asset_id`; `apply_on_day` opcional, inteiro positivo, **agenda** o primeiro dia de efeito pra um dia simulado futuro, N.11, N.11; `reveal_lead_days` opcional, inteiro maior ou igual a 0, é com quantos dias de antecedência do efeito o **jogador** passa a ver o evento no feed e no calendário, padrão a véspera, N.25 — o painel enxerga tudo; vai pra auditoria junto com o resto do corpo). Validado com `interfaces/http/schemas.ts` (`triggerMacroEventBodySchema`, união de duas variantes — template ou avulso) antes de chamar o caso de uso.
- **Sucesso:** `201` → `{ event: {...} }`, corpo de `event` idêntico à resposta de `POST /macro-events` do motor (id, efeitos já amostrados, `fundamentals_report_day` se aplicável, `targets` — array de `{ sector? | risk_class? | asset_id? }` refletindo os alvos persistidos, exatamente um campo preenchido por item).
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — corpo não bate com nenhuma das duas variantes do schema (campo obrigatório ausente, alvo com escopo ambíguo etc.) **ou** o motor rejeitou o evento por uma regra que só ele sabe validar (ex: `template_key` inexistente no catálogo, `asset_id` de alvo que não existe ou não é ação — FII, ETF e renda fixa são recusados — ou `apply_on_day` que não é posterior ao dia simulado corrente ou passa de 365 dias à frente, ou `reveal_lead_days` maior que os dias que faltam até o primeiro dia de efeito) — dupla validação documentada (Zod na borda + `macroevent.NewEvent`/`NewTarget` no motor), não redundância acidental.
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
- **Reautenticação em ação destrutiva:** `POST /admin/tick`, `POST /admin/tick/advance`, `POST /admin/scheduler/pause`, `POST /admin/halts` (pausa de negociação), `POST /admin/assemblies/pauses` (pausa das assembleias) e `POST /admin/orders/cancel-batch` devolvem `401 { error: "reauth_required" }` se a senha não foi conferida nos últimos 5 minutos (login conta). A checagem vem **depois** do `403` de papel (usuário comum nunca vê `reauth_required`) e **antes** de qualquer efeito ou auditoria. Retomar o temporizador e levantar pausa não são destrutivos e não pedem. Fluxo: `POST /auth/reauth` → token novo → repetir a ação.
- **Auditoria de sessão:** `admin.login`, `admin.login_failed`, `admin.reauth`, `admin.reauth_failed` entram em `admin_audit_log` (`target_type = session`). `admin.password_reset_denied` (sempre `failed`) registra o pedido de redefinição de senha por e-mail para uma conta admin, que é negado e não envia nada (D7, `POST /auth/forgot-password`).
- **2FA** fica de fora (Fase 2).

#### Criar e revogar administrador (runbook)

`role = admin` nunca nasce de autocadastro (RNF07). **Criar:** com a stack no ar, `docker compose exec -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e ADMIN_USERNAME=... backend node dist/db/seed.js` (idempotente: e-mail já existente não é alterado). **Revogar:** não há rota nem tela (o painel não promove nem rebaixa `role`, CLAUDE.md); direto no banco, `UPDATE users SET role = 'user' WHERE email = '...'`, e o token antigo morre sozinho em até 2 horas (a revogação imediata de sessão é o "forçar logout" da N.16). Toda ação do admin fica no `admin_audit_log`, que continua consultável depois da revogação.

### `GET /admin/audit-log`

*(Tarefa N.4. Sem backfill: ações administrativas anteriores à tarefa não existem no log.)*

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** query string, todos opcionais, validados por `listAuditLogQuerySchema` (`interfaces/http/schemas.ts`): `admin_id` (uuid), `action` (lista fechada em `domain/auditEntry.ts`: `macro_event.trigger`, `tick.trigger`, `tick.advance`, `scheduler.pause`, `scheduler.resume`, `order.cancel`, `order.cancel_batch`, e as demais da lista fechada, incluindo `admin.login`, `admin.login_failed`, `admin.reauth`, `admin.reauth_failed`, `admin.password_reset_denied`, `user.suspend`, `user.reactivate`, `user.force_logout`, `user.delete`, `announcement.create`, `announcement.update`, `announcement.end`, `maintenance.start`, e as do painel das assembleias `assembly.pause`, `assembly.resume`, `assembly.setting_update`, `assembly.setting_reset`, `assembly.template_create`, `assembly.template_update`, `assembly.template_activate`, `assembly.template_deactivate`, a concessão de PRO `billing.grant_promotional` e as do painel do Diário `daily.start_date`, `daily.draft`, `daily.puzzle_review`, `daily.puzzle_publish`, `daily.puzzle_card`, `daily.word_create`, `daily.word_update`, `daily.question_create`, `daily.question_update`, `daily.event_create`, `daily.event_update`, `daily.accepted_word_add`, `daily.accepted_word_remove`), `result` (`success` | `failed`), `from`/`to` (ISO 8601 com fuso, `from` ≤ `to`), `limit` (inteiro 1–100, padrão 20) e `offset` (inteiro ≥ 0, padrão 0).
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
- **Sucesso:** `204`. Grava `status = suspended`, `suspended_reason`, `suspended_at` e **revoga as sessões** (um token antigo não volta a valer na reativação). A conta sai do ranking e da busca de amigos, perde o login (`403 account_suspended`) e todo token existente passa a receber `403 account_suspended`; o progresso não é tocado. **Não cancela ordens em repouso** (use `POST /admin/orders/cancel-batch`, N.10). Auditoria: `user.suspend` com `payload.reason`. *(EM.5.1.)* Enfileira o aviso `account_suspended` (E6, segurança) com o motivo registrado e a orientação de contestar respondendo ao e-mail (depende de `EMAIL_REPLY_TO`); é o único e-mail que a conta suspensa recebe. Falha ao enfileirar só é logada.
- **Erros:** `400` sem motivo; `401 reauth_required`; `404`; `409` conta já suspensa; `422 { code: "admin_account_protected" }` alvo é `admin` (evita se trancar fora).

#### `POST /admin/users/:id/reactivate`

- **Sucesso:** `204`. Volta a `active`, limpa motivo e instante, **sem perda** de progresso, conquistas, amizades ou posições. As sessões antigas continuam encerradas: a pessoa loga de novo. Auditoria: `user.reactivate`. *(EM.5.1.)* Enfileira o aviso `account_reactivated` (E6).
- **Erros:** `404`; `409` conta que não está suspensa.

#### `POST /admin/users/:id/force-logout`

- **Sucesso:** `204`. Incrementa `users.token_version` (atômico); o `authMiddleware` compara a versão do token com a do banco e devolve `401 sessão encerrada` pra qualquer token emitido antes. A pessoa pode logar de novo. Auditoria: `user.force_logout`. *(EM.4.1.)* Também enfileira o aviso `sessions_ended` (E4) para o e-mail do usuário, um por ação, sem token, sem revelar quem agiu nem o motivo; falha ao enfileirar é só logada e não desfaz o logout nem a auditoria.
- **Erros:** `401 reauth_required`; `404`.

#### `DELETE /admin/users/:id`

- **Payload:** `{ confirm_username }`, o username atual da conta digitado de volta (confirmação dupla junto com a senha recente).
- **Sucesso:** `204`. Mesmo caminho do `DELETE /me` (`AnonymizeAccountUseCase`): anonimiza nome, e-mail, username e senha, desconecta os provedores, apaga a foto e **revoga as sessões**; a linha de `users` e o histórico imutável ficam. Auditoria: `user.delete` com **só o id** do alvo, nunca o username.
- **Erros:** `400` sem `confirm_username`; `401 reauth_required`; `404`; `422 { code: "confirmation_mismatch" }` username não confere; `422 { code: "admin_account_protected" }` alvo é `admin`.

### Correções manuais de conta (tarefa N.17)

Ferramentas de suporte sobre um usuário. Todas exigem Bearer token + `role: 'admin'` e, as que **mudam estado**, senha conferida há menos de 5 minutos (`401 reauth_required`, N.22), e gravam `admin_audit_log` com `target_type = user` e `target_id` = id do usuário (aparecem na linha do tempo do detalhe, N.16). Os ajustes de gamificação e de lição exigem `reason` (3 a 500 caracteres); no crédito o motivo é opcional. Cada correção passa pelo caso de uso do módulo dono do dado (gamificação, conquistas, lições), nunca por update direto. **Resetar carteira fica fora** (apagaria histórico imutável e conflita com RNF06): a alternativa é suspender e criar conta nova.

#### `POST /admin/users/:id/credit`

- **Payload:** `{ amount, reason? }`. `amount` é um número positivo e finito (`NaN` e infinito nem existem em JSON); `reason` até 500 caracteres.
- **Sucesso:** `200` → `{ user_id, credited }`, onde `credited` é o valor de fato creditado (o motor arredonda pra centavos). **Sem teto de negócio** (decisão do autor, achado 029 item 5); o único limite é físico (R$ 1 trilhão por crédito, e saldo final dentro de `numeric(15,2)`). O motor grava o evento imutável `admin_credit` antes de somar em `current_balance` (`POST /admin/accounts/{user_id}/credit`, `.docs/engine/account.md`). É caixa livre: não toca `total_invested` e companhia, então **não altera a rentabilidade do ranking**. No extrato aparece com `event_type = "admin_credit"`, nunca como salário. Auditoria: `user.credit` com `amount`, `reason` (se houver) e `credited`. *(EM.5.1.)* Depois de creditar, enfileira o aviso `account_adjusted` (E10) com o valor creditado; o `reason` é nota interna e **não** vai no e-mail. As correções de XP, streak, conquista e lição (`/xp`, `/streak`, `/grant`, `/complete`, `/reopen`) avisam do mesmo jeito, só com uma frase do que mudou. Falha ao enfileirar só é logada.
- **Erros:** `400` valor inválido na borda (zero, negativo, texto, ausente); `401 reauth_required`; `404` usuário inexistente (ou sem conta no motor); `422 { code: "credit_rejected" }` o motor recusou o valor; `422 { code: "balance_overflow" }` o crédito estouraria o saldo.

#### `POST /admin/users/:id/xp`

- **Payload:** `{ delta, reason }`. `delta` é um inteiro diferente de zero, positivo ou negativo.
- **Sucesso:** `200` → `{ xp, level, current_streak, longest_streak }`. O nível é recalculado do XP total (`levelForXp`), então pode subir ou descer mais de um nível, e as conquistas são reavaliadas (best-effort). O total nunca fica abaixo de zero. Auditoria: `user.adjust_xp` com `delta`, `reason` e o `xp`/`level` resultantes.
- **Erros:** `400` payload inválido; `401 reauth_required`; `404`; `422 { code: "invalid_correction" }` tiraria mais XP do que o usuário tem.

#### `POST /admin/users/:id/streak`

- **Payload:** `{ value, reason }`. `value` é um inteiro de 0 a 36500: o novo streak atual.
- **Sucesso:** `200` → mesmo corpo de `/xp`. `longest_streak` só sobe (é o máximo histórico). Um streak maior que zero conta como "vivo hoje" (`last_qualifying_activity_date` = hoje, UTC), senão o próximo toque o reiniciaria em 1; zero limpa essa data. Auditoria: `user.set_streak`.
- **Erros:** `400`; `401 reauth_required`; `404`.

#### `POST /admin/users/:id/achievements/:achievementId/grant`

- **Payload:** `{ reason }`.
- **Sucesso:** `204`. Concede a conquista **sem checar o critério**. Não existe `/revoke` (removida na N.26): se o usuário ainda satisfaz o critério, a próxima checagem automática (XP, streak, lição) a concederia de novo, então a ação prometia algo que não acontecia; a rota agora responde `404`. Auditoria: `user.grant_achievement` com `achievement_id`, `achievement_name` e `reason` (as linhas `user.revoke_achievement` já gravadas continuam legíveis no histórico).
- **Erros:** `400` sem motivo ou id que não é UUID; `401 reauth_required`; `404` usuário ou conquista inexistente; `409` o usuário já tem a conquista.

#### `GET /admin/users/:id/pro`

- **Sucesso:** `200` → `{ is_pro, state, plan, store, expires_at }`, o mesmo plano que a pessoa vê em `GET /billing/status`, lido pelo `GetSubscriptionStatusUseCase` do módulo `billing` (única fonte da verdade; nunca claim de JWT). `plan` e `store` são `null` sem plano; `store` é `promotional` quando o acesso vem de concessão.
- **Erros:** `401`, `403`, `404` usuário inexistente.

#### `POST /admin/users/:id/pro-grants`

- **Payload:** `{ days, reason }`. `days` é um inteiro de 1 a 90 (teto por concessão, decisão do autor em 2026-10-11); `reason` é obrigatório, de 5 a 500 caracteres. Exige papel admin e **senha conferida há pouco** (`401 reauth_required`).
- **Sucesso:** `200` → `{ user_id, ends_at, previous_access_end }`. A concessão **empilha**: conta a partir do fim do acesso atual (assinatura paga ou concessão anterior), nunca por cima dele, então não encurta nada; quem não é PRO, ou já venceu, conta a partir de agora. Passa pelo `GrantPromotionalProUseCase` do módulo `billing` (RevenueCat, ou a projeção local com `BILLING_PROVIDER=dev`), então a concessão aparece em `GET /billing/status` da pessoa. Auditoria: `billing.grant_promotional` com `days`, `reason`, `ends_at` e `previous_access_end`. Não envia e-mail à pessoa. Não há revogação pelo painel nesta fase.
- **Erros:** `400` payload inválido; `401 reauth_required`; `404` usuário inexistente; `409` a pessoa já tem PRO sem vencimento (nada a empilhar); `422 { code: "pro_grant_rejected" }` período fora de 1 a 90; `502 { code: "billing_provider_error" }` falha do RevenueCat (nada foi concedido, dá para repetir); `503 { code: "billing_disabled" }` cobrança desligada no ambiente.

#### `POST /admin/users/:id/lessons/:lessonId/complete` e `/reopen`

- **Payload:** `{ reason }`.
- **Sucesso:** `204`. `complete` grava a conclusão sem passar pelo gate de passos nem de desbloqueio, e **não dá XP**, não toca o streak, não conta pra missão e não vai pro feed (o XP, se devido, é um ajuste separado em `/xp`). `reopen` limpa a conclusão e volta pro passo 0, mantendo a escolha da micro-decisão e o XP já dado; como a progressão conta lições satisfeitas, reabrir uma lição no meio do currículo faz o usuário perder o acesso à última que ela liberou até concluí-la de novo. Auditoria: `user.complete_lesson` / `user.reopen_lesson` com `lesson_id`, `lesson_code` e `reason`.
- **Erros:** `400`; `401 reauth_required`; `404` usuário ou lição inexistente; `409` a lição já está concluída (`complete`) ou não está concluída (`reopen`).

#### `GET /admin/users/:id/corrections`

- **Sucesso:** `200` → `{ achievements: [{ id, name, description, unlocked }], lessons: [{ id, code, title, track_number, status }] }`, o que a tela precisa pra montar os seletores. `status` da lição: `completed` | `in_progress` | `not_started`. Leitura: não audita.
- **Erros:** `400` id que não é UUID; `404`.

### Gamificação: conquistas, missões e ranking (tarefa N.19)

Seis rotas, todas só para `role: 'admin'` (`401` sem token, `403` para usuário comum). Editar o catálogo é **auditado** (`achievement.create`, `achievement.update`, `mission.update`, com o que foi pedido) mas **não pede senha recente**: não apaga dado de ninguém. Cada edição passa pelos casos de uso dos módulos donos do dado (conquistas, missões); o ranking reaproveita o caso de uso do jogador. `404` para id inexistente, `400` para id que não é UUID ou corpo inválido na borda, `409` para nome de conquista repetido, `422 { code: "invalid_catalog_entry" }` para o que a regra de domínio recusa (meta, nome, XP).

#### `GET /admin/gamification/achievements`

- **Sucesso:** `200` → `{ achievements: [{ id, name, description, criteria_type, criteria_value, is_active, is_rare, unlocked_count }], criteria: [{ type, label, value_kind }] }`. `unlocked_count` é quantos usuários já ganharam. `criteria` é a **lista fechada** de regras que o código sabe avaliar (`net_worth`, `streak_days`, `lessons_completed`, `trades_executed`, `micro_decisions_streak`, `track_completed_no_errors`, `lesson_reviewed`), com `value_kind` `integer` ou `currency`: o painel escolhe uma, nunca digita expressão.

#### `POST /admin/gamification/achievements`

- **Payload:** `{ name, description?, criteria_type, criteria_value }`. `name` de 1 a 100 caracteres, `description` até 255, `criteria_value` positivo (inteiro nos critérios `integer`, até duas casas em `currency`, no máximo R$ 1 trilhão).
- **Sucesso:** `201` → a conquista criada (mesmo formato da lista, `unlocked_count: 0`). Nasce **ativa**, sem `seed_key`. Auditoria: `achievement.create` com o que foi pedido e o id criado.
- **Erros:** `400`; `409` nome já usado (sem diferenciar caixa); `422`.

#### `PATCH /admin/gamification/achievements/:id`

- **Payload:** qualquer subconjunto, ao menos um campo: `name`, `description` (`null` limpa), `criteria_type`, `criteria_value`, `is_active`, `is_rare` (marca a conquista como rara no catálogo; é o que dispara o e-mail de conquista rara, ponto 044; nasce `false` na criação e se marca por aqui).
- **Sucesso:** `200` → a conquista atualizada. O estado final é validado (trocar só o tipo de critério de uma meta em reais por um de contagem é recusado se a meta não for inteira). **Desativar nunca remove o que o usuário já ganhou**: a conquista deixa de ser concedida e some pra quem ainda não a tem; mudar meta ou regra só vale pras próximas concessões, ninguém é revogado. Auditoria: `achievement.update` só com os campos pedidos.
- **Erros:** `400`; `404`; `409`; `422`.

#### `GET /admin/gamification/missions`

- **Sucesso:** `200` → `{ missions: [{ id, key, title, description, completion_criteria, xp_reward, is_active, verification, completed_users, completed_today }] }`. `verification`: `lesson_completion`, `server_check` ou `client_reported` (como a conclusão é conferida, só leitura). `completed_users` conta usuários distintos que concluíram a missão em qualquer dia; `completed_today`, no dia corrente (UTC).

#### `PATCH /admin/gamification/missions/:id`

- **Payload:** qualquer subconjunto, ao menos um campo: `title` (1 a 150), `description` (até 500, `null` limpa), `xp_reward` (inteiro de 1 a 500), `is_active`. Não existe rota pra criar missão nem pra mudar o tipo de conferência (é código; uma missão nova sem conferência seria XP de graça).
- **Sucesso:** `200` → a missão atualizada. **Missão desativada não é sorteada pro dia** (nem ganha linha de progresso nova) e não pode mais ser concluída (`404` em `POST /missions/:id/complete`); o que já foi concluído e o XP dado ficam como estão. O XP novo vale pra quem concluir a partir de agora. Auditoria: `mission.update` com os campos pedidos e a `key`.
- **Erros:** `400`; `404`; `422` (XP fora da faixa, título vazio).

#### `GET /admin/gamification/ranking`

- **Payload:** query `window` (`week` | `month`, obrigatório exceto com `criterion=level`), `criterion` (`overall` padrão | `fixedIncome` | `variableIncome` | `level`), `page` (1-based, padrão 1; páginas de 25).
- **Sucesso:** `200` → `{ window, window_start, window_end, criterion, entries: [{ position, user_id, username, level, xp, profitability_pct }], page, page_size, total_entries, total_pages }`. **Somente leitura**: é o ranking global da janela corrente (UTC, mesmo cálculo do `GET /ranking`), calculado na hora, sem janela gravada, então não há o que fechar nem recalcular. `window_start`/`window_end` mostram o período (`null` no critério de nível, que é cumulativo). Só nível, XP e rentabilidade percentual: nunca patrimônio absoluto (RNF09). Custa chamadas ao motor por usuário, por isso a tela só consulta quando a aba está aberta.
- **Erros:** `400` parâmetros inválidos.

### Conteúdo das lições: funil e publicação (tarefa N.18)

Exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum). Publicar e despublicar são auditados, mas não pedem senha recente: não apagam dado de ninguém e desfazem-se com o gesto contrário.

#### `GET /admin/lessons`

- **Sucesso:** `200` → `{ lessons: [...] }`, **todas** as lições (publicadas ou não) em ordem da trilha. Cada item: `{ id, code, title, track_number, track_name, sort_order, micro_decision_type, has_bet, unlocks_keys, published, prerequisite_code, funnel }`. `prerequisite_code` é o código da publicada anterior na ordem (a progressão é linear); `null` na primeira e nas despublicadas. `funnel`: `{ started, completed, abandoned, completion_rate, avg_seconds_to_complete, median_seconds_to_complete, bet_answered, bet_correct, bet_accuracy, abandoned_by_step: [n, n, n, n] }`.
- **Como o funil é contado** (a partir de `user_lesson_progress`): `started` são as linhas que não são só uma dispensa nunca aberta (N.24), `completed` as com `completed_at`; `abandoned_by_step` distribui quem iniciou e não concluiu pelo passo gravado (0 cenário, 1 micro-decisão, 2 revelação, 3 desbloqueio). O tempo é de iniciar a concluir, só de quem concluiu sem dispensa, e **inclui pausas** (quem volta no dia seguinte), por isso a mediana vem junto da média. A aposta só conta quem concluiu com a escolha gravada, em lição com aposta real. As taxas são `null` quando não há base (ninguém iniciou, lição sem aposta respondida).

#### `GET /admin/lessons/:id/card-funnel`

- **Query:** `days` (inteiro de 1 a 365, padrão 30): janela em dias UTC contando hoje (1 = só hoje).
- **Sucesso:** `200` → `{ lesson: { id, code, title }, days, since, bars: [{ phase, card_index, reached, lost, lost_rate }], biggest_drop: { phase, card_index } | null }`. Uma barra por cartão que alguém alcançou na janela, na ordem da lição (`phase` 0 Cenário, 1 Micro-decisão, 2 Revelação, 3 tela final). `reached` = pessoas que chegaram ao cartão; `lost` = quantas chegaram ao cartão anterior e não a este (nunca negativo; 0 no primeiro); `lost_rate` = `lost` sobre os do cartão anterior (`null` no primeiro ou sem base). `biggest_drop` é o cartão com mais pessoas perdidas (o primeiro em empate), `null` se ninguém caiu. Sem dado individual: só contagem.
- **Limites da medição:** conta a partir do deploy da tarefa LJ.5.1; quem retomou uma lição no meio entra a partir de onde parou (um cartão pode ter mais gente que o anterior; a queda é truncada em 0); o índice é o do player no momento, então depois de reeditar o texto de uma lição o funil antigo deixa de corresponder (use uma janela curta). Lição legada sem `blocks` funciona igual (o player fatia o texto).
- **Erros:** `400` `days` fora de 1 a 365 ou `id` que não é UUID; `404` lição inexistente. Leitura, sem auditoria.

#### `PATCH /admin/lessons/:id/published`

- **Payload:** `{ "published": true | false }`.
- **Sucesso:** `200` → `{ id, code, title, published, waived_users }`. **Despublicar** tira a lição da trilha e da conta de progressão de todos sem apagar progresso: ninguém fica travado (as seguintes não passam a exigir uma contagem que o usuário não alcança) nem pula uma lição. **Publicar de volta** concede dispensa (N.24) a quem já satisfez o número de lições equivalente à posição dela (quem já tinha concluído a própria lição fica como está); `waived_users` diz quantos. A dispensa libera as chaves de produto e não dá XP.
- **Erros:** `400` corpo inválido ou `id` que não é UUID; `404` lição inexistente; `409` a lição já está no estado pedido.
- **Auditoria:** `lesson.publish` / `lesson.unpublish`, `target_type = lesson`, `payload = { code, waived_users }`; a recusa grava `result = failed`.

### Editor de lições: conteúdo, criação e histórico (tarefa N.23)

O banco é a fonte da verdade do conteúdo das lições (o seed só importa, ver `.docs/backend/lessons.md`). Todas exigem Bearer token + `role: 'admin'` (`401`/`403`). Editar, criar e restaurar são auditados mas **não pedem senha recente**: não apagam dado de ninguém e cada mudança vira uma revisão restaurável. Conteúdo = `title`, `central_concept`, `scenario_text`, `micro_decision_prompt`, `micro_decision_type`, `micro_decision_asset_ticker`, `micro_decision_options`, `micro_decision_correct_option`, `revelation_text`, `unlocks_description`, `unlocks_keys`, `unlocks_asset_ticker`. `stable_key`, `code`, `track_number`, `sort_order` de lição existente **não são editáveis**. Não há exclusão de lição (só despublicar, N.18).

**Regras de domínio (as mesmas na edição, na criação e na restauração; `422` com todas as recusas juntas):** título e conceito central obrigatórios; limites de tamanho (título 150, conceito 500, cenário/micro-decisão/revelação 5000, descrição do desbloqueio 500); aposta = 2 a 6 opções (texto, até 200 caracteres, sem repetir) mais a opção correta dentro da faixa, as duas juntas ou nenhuma, e nunca nos tipos `growth_calculator`/`fixed_income_comparison` (o widget já é a interação); `live_indicator` exige `micro_decision_asset_ticker` e os outros tipos não aceitam; `unlocks_keys` só do vocabulário fechado (`portfolio`, `calculator`, `news_feed`, `asset:<AssetType>`), sem repetir; chave `asset:*` exige `unlocks_asset_ticker` e vice-versa; todo ticker precisa **existir no catálogo do motor** (`GET {ENGINE_URL}/assets`) e o do produto desbloqueado precisa ser de um tipo presente nas chaves `asset:*`. **Aviso, não bloqueio:** travessão (`—`) em texto do produto vai em `warnings` (regra de copy).

#### `GET /admin/lessons/:id`

- **Sucesso:** `200` → `{ lesson: { id, code, track_number, track_name, sort_order, published, ...conteúdo }, revisions: [{ id, action, admin_id, admin_username, created_at }] }`, revisões da mais recente à mais antiga. Devolve a opção correta da aposta (o painel precisa dela pra editar; o jogador nunca a vê em `GET /lessons`). `action`: `baseline` (retrato do original, gravado antes da primeira edição de uma lição vinda do seed, sem admin), `create`, `update`, `restore`.
- **Erros:** `400` id que não é UUID; `404`.

#### `PUT /admin/lessons/:id`

- **Payload:** o conteúdo **inteiro** (substitui, não mescla), em snake_case.
- **Sucesso:** `200` → `{ lesson, warnings }`. Grava o conteúdo e a revisão `update` numa transação.
- **Erros:** `400` formato; `404`; `409` nenhuma mudança em relação ao conteúdo atual (não gera revisão vazia); `422` regra de domínio (`{ error, code: 'invalid_lesson' }`).
- **Auditoria:** `lesson.update`, `target_type = lesson`, `payload = { code, changed_fields: [nomes dos campos] }` (nunca o texto); a recusa grava `result = failed` com a mensagem. Quem já respondeu a aposta mantém a escolha gravada: mudar as opções de uma lição com respostas não reescreve o histórico, e o acerto passa a ser calculado contra a opção correta nova.

#### `POST /admin/lessons`

- **Payload:** o conteúdo mais `after_lesson_id` (UUID da lição depois da qual a nova entra, na trilha dela; `null` = início do currículo).
- **Sucesso:** `201` → `{ lesson, warnings, waived_users }`. Numa transação serializada por lock: desloca o `sort_order` das seguintes (em duas passadas, pelo negativo, por causa do `UNIQUE`), insere a lição **publicada** com `stable_key` (`adm-` + 12 hex) e `code` (`<trilha>.<próximo número livre>`) gerados, concede **dispensa** (N.24) a quem já tinha passado daquele ponto (`waived_users`) e grava a revisão `create`. Quem estava na posição ou antes é bloqueado por ela normalmente; ninguém que já passou perde acesso. O `code` é só rótulo de posição didática e não é renumerado nas outras lições, então pode não seguir a ordem.
- **Erros:** `400`; `404` lição de referência inexistente; `422`.
- **Auditoria:** `lesson.create`, `target_id` = id criado, `payload = { after_lesson_id, title, code, waived_users }`.

#### `GET /admin/lessons/:id/revisions/:revisionId`

- **Sucesso:** `200` → `{ id, action, admin_id, admin_username, created_at, ...conteúdo }` (o retrato daquela revisão). **Erros:** `400`; `404` revisão inexistente ou de outra lição.

#### `POST /admin/lessons/:id/revisions/:revisionId/restore`

- **Sucesso:** `200` → `{ lesson, warnings }`. Volta o conteúdo ao retrato daquela revisão e grava uma revisão nova `restore` (o histórico só cresce; `lesson_revisions` é append-only por trigger no banco). O conteúdo restaurado passa pela mesma validação (o catálogo pode ter mudado desde então).
- **Erros:** `404`; `409` o conteúdo atual já é igual ao da revisão; `422`.
- **Auditoria:** `lesson.restore`, `payload = { revision_id, code, changed_fields }`.

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

- **Sucesso:** `200` → `{ checked_at, components: [{ key, status, latency_ms | null, detail | null }] }`, sempre nesta ordem: `backend`, `engine`, `gamification_db`, `market_db`, `redis`, `email_outbox`. `status` é `ok`, `degradado` (respondeu, mas em mais de 1000 ms) ou `fora` (falhou ou não respondeu em 3 s; `latency_ms` vira `null` e `detail` traz o motivo).
- **Erros:** nenhum próprio. Um componente fora **não** derruba a resposta, só aparece como `fora`.
- **Regra:** `GetSystemHealthUseCase` sonda os componentes em paralelo por `HealthProbe` (porta): `engine` = `GET /health` do motor; `gamification_db` = `select 1` no pool do backend; `redis` = `PING`; `market_db` = a leitura da visão geral do motor (só o motor fala com esse banco, então se ela responde o banco está de pé). O `backend` é `ok` por definição.
  - **`email_outbox` (EM.8.1)** não é uma sonda de resposta, é uma leitura de contadores da fila de e-mail (`EmailOutboxHealthReader`, porta; adapter Drizzle sobre `email_outbox`). `detail` sempre traz o resumo (`"N pendente(s), M falha(s) em 24 h"`); `latency_ms` é o tempo da leitura. **Pendente** = linha `pending` já vencida (`next_attempt_at <= agora`); um reenvio agendado pra daqui a horas não conta. `degradado` (alerta, não queda) quando a pendente vencida mais antiga espera **há mais de 10 min** (fila parada: worker fora ou provedor recusando) ou quando há **5 ou mais** falhas definitivas (`failed`) nas últimas 24 h ("falhas acumulando"; o `detail` diz qual). Leitura que falha vira `fora`, como qualquer componente.

#### `GET /admin/overview`

- **Sucesso:** `200` → `{ market, scheduler, last_tick, users, errors }`.
  - `market`: o corpo de `GET /admin/overview` do motor (ver `.docs/engine/admin.md`).
  - `scheduler`: o corpo de `GET /admin/scheduler` (agenda ligada/pausada, próximo slot).
  - `last_tick`: a linha mais recente de `GET /admin/ticks`, ou `null` se nunca houve tick.
  - `users`: `{ total, signups_last_24h, signups_last_7d }`, só contas `role = user`.
  - `errors`: por seção que falhou (`market`, `scheduler`, `last_tick`, `users`), a mensagem do erro; vazio quando tudo respondeu.
- **Erros:** nenhum próprio. Uma fonte fora vira `null` na seção dela e a mensagem em `errors`; as demais seguem. A tela de entrada precisa abrir justamente quando algo está quebrado.

### Painel de retenção (tarefa RT.1.2)

#### `GET /admin/retention`

Exige Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum). Só leitura: não passa pela auditoria. **Só números agregados**: nenhuma lista de pessoas, nenhum identificador, nenhum patrimônio (RP4, RNF09). Conta apenas `role = user`. Todos os dias são datas UTC (`AAAA-MM-DD`), a mesma convenção do streak.

- **Payload:** query opcional validada por `retentionQuerySchema`: `weeks` (1 a 52, padrão 12; quantas semanas de coorte, contando a semana atual) e `days` (7 a 180, padrão 60; tamanho do gráfico de ativos por dia).
- **Sucesso:** `200` → `{ cohorts, active, milestones }`.
  - `cohorts`: `{ tracking_since: { presence, activity }, cohorts: [...] }`. `tracking_since` é o primeiro dia com registro de cada medida (`null` = ainda sem registro). Cada coorte (semana de cadastro, mais recente primeiro): `{ cohort_week, size, returned: { d1, d7, d30 }, studied: { d1, d7, d30 } }`. **"voltou"** = qualquer acesso autenticado exatamente no dia N depois do cadastro (`daily_presence`); **"estudou"** = atividade qualificadora nesse dia (`daily_activity`). Cada célula: `{ status, rate, measured, size }`, com `status`:
    - `complete`: todos da coorte foram medidos; `rate` = fração que apareceu no dia N (0 a 1);
    - `partial`: só parte foi medida (o resto ainda está em andamento ou é anterior ao registro); `rate` vale para os `measured`;
    - `in_progress`: o dia N ainda não fechou para ninguém da coorte; `rate = null`. **Nunca é zero**;
    - `no_data`: o dia N é anterior ao início do registro daquela medida; `rate = null`.
  - `active`: `{ tracking_since, days: [{ day, returned, studied, mau, dau_mau }] }`, do mais antigo para o mais recente, terminando **ontem** (o dia corrente ainda não fechou). `returned` = pessoas com presença no dia (DAU), `studied` = com atividade, `mau` = pessoas distintas com presença nos 30 dias que terminam no dia, `dau_mau = returned / mau`. Cada campo é `null` antes do início do registro da medida; `mau` e `dau_mau` só existem depois que os 30 dias da janela estão todos dentro do período registrado (um MAU incompleto inflaria a razão).
  - `milestones`: `{ tracking_since, eligible, milestones: [...], cohorts: [...] }`. Só entram pessoas cadastradas **depois** do primeiro dia de registro (as anteriores não têm marco gravado; `tracking_since` é esse corte, `null` sem registro). `milestones` traz, nesta ordem, `first_return` (primeiro acesso depois do dia do cadastro, com precisão de dia, `granularity: 'day'`), `first_lesson`, `first_trade` (primeira operação real: ação, FII, ETF ou renda fixa do mercado ao vivo, Sandbox não conta), `first_fixed_income` e `first_daily`; cada um `{ milestone, granularity: 'day' | 'second', reached, reached_rate, median_seconds }` (mediana do tempo entre o cadastro e o marco, só de quem chegou; `null` se ninguém chegou). `cohorts`: por semana de cadastro `{ cohort_week, size, status, rates }`, com `rates` = fração da coorte que chegou em cada marco e `status` `complete` (30 dias depois do fim da semana) ou `in_progress` (a % ainda está subindo).
- **Erros:** `400` — `weeks` ou `days` fora do intervalo ou não inteiros (`{ error: 'parâmetros do painel de retenção inválidos', details }`).
- **Regra:** três casos de uso (`GetRetentionCohortsUseCase`, `GetActiveUsersUseCase`, `GetMilestoneTimesUseCase`) sobre uma porta de consultas agregadas (`RetentionReader`, adapter Drizzle com SQL agregado); nada é calculado no router. Presença é gravada pelo middleware de autenticação (no máximo uma escrita por pessoa por dia UTC) e os marcos pelos casos de uso donos de cada fato (RT.1.1). Os dados começam a contar na publicação da RT.1.1.

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

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/admin.md`, que descreve as faixas e o efeito). Dois grupos de chaves editáveis, cada um lido pela sua tela: o **ritmo** (`ticks_per_day`, `max_catch_up`, tela de Tempo) e a **governança das assembleias** (`governance_growth_step_centipp`, `governance_quality_step_centi`, `governance_ramp_ticks`, `governance_cooldown_days`, tela de Assembleias, MO.6.8; faixa de efeito, rampa e cooldown da MO.6.2, mais, da Fase F2, `governance_payout_step_centipp`, `governance_payout_min_pct`, `governance_payout_max_pct`, `governance_payout_cooldown_days`, `governance_premium_step_centipp`, `governance_premium_min_pct`, `governance_premium_max_pct`, `governance_hold_declarations` e `governance_declaration_safety_days`; ver `.docs/engine/governance.md`). O motor guarda tudo junto; o backend só devolve o grupo pedido.

#### `GET /admin/settings`

- **Payload (query), opcional:** `group` (`pace` padrão, ou `governance`), validado por `engineSettingsQuerySchema`.
- **Sucesso:** `200` → `{ editable: [{ key, value, default, min, max, overridden, updated_by, updated_at, version }], read_only: [{ key, value, reason }] }`, com `editable` só do grupo pedido.
- **Erros:** `400` — `group` desconhecido (o motor não é chamado).

#### `PUT /admin/settings/:key`

- **Payload (JSON):** `value` (inteiro), validado por `updateEngineSettingBodySchema`. O `admin_id` vem do token.
- **Sucesso:** `200` → o mesmo corpo do `GET` (do grupo da chave), com o valor novo.
- **Erros:** `400` — `value` não é inteiro (o motor não é chamado); `404` — `key` não é editável (o motor não é chamado); `422` — fora da faixa, com a mensagem do motor.
- **Auditoria:** `settings.update`, `target_type = engine_setting`, `target_id` = a chave, `payload = { key, value }`; a recusa do motor grava `result = failed` com o motivo. O valor anterior não vai no payload: está na linha anterior da mesma chave.

#### `DELETE /admin/settings/:key`

- **Sucesso:** `200` → o mesmo corpo do `GET` (do grupo da chave), com a chave no padrão do ambiente.
- **Erros:** `404` — `key` não é editável.
- **Auditoria:** `settings.reset`, `target_id` = a chave, `payload = { key }`.

### Assembleias (tarefa MO.6.8)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum) e **funcionam também com o recurso desligado** (`ASSEMBLIES_ENABLED=off`, desligamento de emergência, só tira o ciclo e as rotas de usuário do ar): a calibração (MO.6.9) não depende dele. A regra vive no módulo `assemblies`; aqui a borda, a auditoria e a tradução dos erros (`404`, `409`, `422`). Corpos e respostas em `snake_case`, como o restante do painel. **Privacidade:** o admin vê o voto por pessoa e o peso em ações (exceção deliberada, como o patrimônio absoluto, ver `CLAUDE.md`); **a leitura não é auditada, toda escrita é**.

#### `GET /admin/assemblies`

- **Payload (query), opcional:** `status` (`scheduled`, `open` ou `closed`), validado por `assemblyListQuerySchema`; sem ele devolve os três (as 100 mais recentes).
- **Sucesso:** `200` → `{ assemblies: [{ id, kind, subject_ref, subject_label, title, status, opens_at, closes_at, effect_applies_at, effect_applied_at, outcome, outcome_reason, voter_count, winning_option_id, min_voters, effect_pending, paused, declaration_id, dividend_on_hold }] }`. `min_voters` é o quórum congelado na abertura (`null` em assembleia anterior ao parâmetro). `effect_pending`: aprovada, efeito já devido e ainda não entregue ao motor. `paused`: há pausa vigente cobrindo a assembleia. `declaration_id` (MO.6.13) é a declaração de dividendo retida que a assembleia libera (`null` nas assembleias comuns) e `dividend_on_hold` diz se o dividendo ainda está retido por ela.
- **Erros:** `400` — `status` inválido.

#### `GET /admin/assemblies/:id`

- **Sucesso:** `200` → `{ assembly, options: [{ id, key, label, gain, loss, effect: { metric ('growth' | 'quality'), direction, intensity } | null, position, voters, weight }], min_voters, counted_voters, holders, votes: [{ user_id, username, name, option_id, weight, eligible, created_at, updated_at }] }`. `weight` são as ações na data de corte (nulo e `eligible = false` quando a pessoa não era acionista: o voto é descartado na apuração); `holders` são as pessoas com posição na data de corte; `min_voters` é o quórum que vale para esta assembleia (o da abertura, ou o de agora se anterior ao parâmetro). Assembleia ainda `scheduled` não tem snapshot nem voto.
- **Erros:** `400` — `id` não é UUID; `404` — inexistente.

#### `GET /admin/assemblies/pauses`

- **Sucesso:** `200` → `{ active: [...], recent: [...] }`; item `{ id, scope ('global' | 'company'), company_id | null, reason, created_by, created_at, lifted_at | null, lifted_by | null }`. `recent` são as últimas encerradas (até 20).

#### `POST /admin/assemblies/pauses`

- **Payload (JSON):** `scope` (`global` | `company`), `company_id` (id da empresa; obrigatório com `company`, proibido com `global`), `reason` (1 a 300 caracteres, aparado), validados por `pauseAssembliesBodySchema`. Exige senha conferida há pouco (`requireRecentAuth`, como a pausa de negociação). O `admin_id` vem do token.
- **Regra:** a pausa **impede abrir assembleia nova e aplicar efeito no motor**. Fechar e apurar seguem (o prazo de voto é uma promessa a quem vota) e votar continua liberado. Nada se perde: a assembleia que ficaria agendada e o efeito pendente esperam; na rodada seguinte à retomada o ciclo abre e aplica (de hora em hora, ou ao reiniciar). **Limite:** um balanço que passar da janela de recuperação (`catch_up_days`) durante a pausa não abre assembleia depois. Uma pausa global vale para qualquer kind; a de empresa, só para ela. Uma vigente por escopo.
- **Sucesso:** `201` → a pausa criada.
- **Erros:** `400` — corpo inválido; `409` — já existe pausa vigente no escopo; `422` — motivo vazio ou fora do tamanho.
- **Auditoria:** `assembly.pause`, `target_type = assembly_pause`, `target_id` = id da pausa, `payload = { scope, subject_ref | null, reason }`; a recusa grava `result = failed`.

#### `POST /admin/assemblies/pauses/:id/lift`

- **Payload:** nenhum (`id` UUID no caminho).
- **Sucesso:** `200` → a pausa encerrada.
- **Erros:** `400` — `id` não é UUID; `404` — inexistente; `409` — já encerrada.
- **Auditoria:** `assembly.resume`, `target_id` = id da pausa.

#### `GET /admin/assemblies/settings`

- **Sucesso:** `200` → `{ settings: [{ key, value, default, min, max, overridden, updated_by, updated_at }] }`, os 11 parâmetros do backend: `min_voters` (1-1000), `duration_days` (1-60, dias reais), `open_delay_days` (1-30, dias simulados), `catch_up_days` (1-30, dias simulados), `effect_delay_days` (1-30, dias reais), `monthly_free_credits` (1-10), `free_credit_min_level` (1-100), `participation_xp` (1-500), `proposal_monthly_cap` (1-20), `proposal_min_support` (1-50), `proposal_ttl_days` (1-180, dias reais). `default` é o valor inicial do servidor (variável de ambiente `ASSEMBLY_*` ou padrão do código); sem linha gravada vale ele. A faixa de efeito, a rampa e o cooldown são do motor (`GET /admin/settings?group=governance`).

#### `PUT /admin/assemblies/settings/:key`

- **Payload (JSON):** `value` (inteiro), validado por `updateAssemblySettingBodySchema`; `key` por `assemblySettingKeySchema`. O `admin_id` vem do token.
- **Regra:** vale **só para as próximas assembleias** e passa a valer na hora no processo (e a cada rodada do ciclo, que relê a tabela). O quórum (`min_voters`) é gravado na assembleia ao abrir, então mudar depois não altera uma já aberta; duração e atrasos já foram aplicados às datas dela. Crédito mensal, nível mínimo, XP e os limites de proposta valem a partir da próxima consulta.
- **Sucesso:** `200` → `{ settings }` (a lista nova).
- **Erros:** `400` — `value` não é inteiro; `404` — chave desconhecida; `422` — fora da faixa (a mensagem traz a faixa).
- **Auditoria:** `assembly.setting_update`, `target_type = assembly_setting`, `target_id` = a chave, `payload = { key, value }`; a recusa grava `result = failed`.

#### `DELETE /admin/assemblies/settings/:key`

- **Sucesso:** `200` → `{ settings }`, com a chave de volta ao valor inicial.
- **Erros:** `404` — chave desconhecida.
- **Auditoria:** `assembly.setting_reset`, `target_id` = a chave, `payload = { key }`.

#### `GET /admin/assemblies/agenda-templates`

- **Sucesso:** `200` → `{ templates: [{ key, purpose, sector | null, title, description, options: [{ key, label, gain, loss, effect }], active, created_at, usage: { assemblies, active_proposals } }] }`. `purpose` é `general` ou `profit` (assembleia de destinação do lucro, MO.6.13). `effect` é `{ effects: [...] }` (de 1 a 2 efeitos, ver `assemblies.md`) ou, em pautas antigas, o objeto de um efeito só., todas as pautas (ativas ou não) por chave. `usage` mostra onde a pauta já foi usada.

#### `POST /admin/assemblies/agenda-templates`

- **Payload (JSON):** `key`, `sector` (um dos 6 setores do motor: Mineração, Agronegócio, Bancário/Financeiro, Varejo, Energia, Tecnologia; vazio ou `null` vale para qualquer setor; outro texto é recusado com `400`, ponto 051), `purpose` (opcional, `general` ou `profit`; padrão `general`), `title`, `description`, `options` (de 2 a 4), cada uma com `key`, `label`, `gain`, `loss` e `effect`: `{ effects: [...] }` com de 1 a 2 efeitos `{ metric, direction, intensity }` ou, na política de dividendo, `{ metric: "dividend_policy", value }` (o formato antigo, um objeto de um efeito só, também vale); formato validado por `createAgendaTemplateBodySchema`.
- **Regra (módulo `assemblies`, `validateTemplateInput`):** chave da pauta de 3 a 60 caracteres (minúsculas, números e `_`, começando por letra) e **definitiva**; chave de opção de 2 a 40, única na pauta; título 3-120, descrição 10-500, setor 2-40, rótulo 3-100, ganho e perda 3-200; **sem travessão** em nenhum texto (aparece no app); **de 1 a 2 efeitos por opção, em alavancas diferentes** entre `base_growth_pct`, `quality_multiplier`, `payout_ratio_pct`, `pn_dividend_premium_pct` (todas com `direction` 1 ou -1 e `intensity` em (0, 1], fração da faixa do motor; o motor valida de novo ao aplicar) e `dividend_policy` (com `value` `quarterly`, `semiannual` ou `annual`, sem sentido nem intensidade). O `effect` é sempre guardado no formato novo, com só os campos conhecidos de cada efeito.
- **Sucesso:** `201` → a pauta criada, ativa.
- **Erros:** `400` — formato; `409` — já existe pauta com a chave; `422` — regra acima.
- **Auditoria:** `assembly.template_create`, `target_type = agenda_template`, `target_id` = a chave, `payload = { sector, title, options (as chaves) }`.

#### `PUT /admin/assemblies/agenda-templates/:key`

- **Payload (JSON):** o mesmo conteúdo do `POST`, sem `key` (validado por `agendaTemplateContentSchema`). Nunca troca a chave nem o estado ativo.
- **Regra:** vale para o **sorteio das próximas assembleias** e para as **propostas na fila** (que referenciam a pauta pela chave). As assembleias já abertas guardam a própria cópia das opções (`assembly_options`) e **não mudam**.
- **Sucesso:** `200` → a pauta atualizada.
- **Erros:** `400` — formato; `404` — pauta inexistente; `422` — regra.
- **Auditoria:** `assembly.template_update`, mesmo `payload` do `POST`.

#### `POST /admin/assemblies/agenda-templates/:key/active`

- **Payload (JSON):** `active` (booleano).
- **Regra:** desativar tira a pauta do sorteio e das propostas novas; **pauta nunca se apaga** (propostas e assembleias a referenciam).
- **Sucesso:** `200` → a pauta atualizada.
- **Erros:** `400` — `active` não é booleano; `404` — inexistente.
- **Auditoria:** `assembly.template_activate` ou `assembly.template_deactivate`, `target_id` = a chave.

### Catálogo de ativos (tarefa N.12)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/admin.md#catálogo-de-ativos-tarefa-n12`, que descreve os campos por classe e as regras).

#### `GET /admin/catalog`

- **Sucesso:** `200` → `{ assets: [{ asset_id, ticker, name, type, risk_class, is_sandbox, share_class, outstanding_shares, editable: [campos], company, etf, fii, fixed_income }] }`. Só o bloco da classe vem preenchido; `editable` é vazio pra ativo do sandbox.

#### `PATCH /admin/catalog/:id`

- **Payload (JSON):** qualquer subconjunto de `name`, `base_growth_pct`, `quality_multiplier`, `methodology_summary`, validado por `updateCatalogAssetBodySchema` (estrito: outro campo, como `ticker` ou `outstanding_shares`, é recusado). O `admin_id` vem do token.
- **Sucesso:** `200` → o ativo já alterado (mesmo formato de um item do `GET`).
- **Erros:** `400` — `id` não é UUID, corpo vazio, campo desconhecido ou tipo errado (o motor não é chamado); `404` — ativo inexistente; `422` — regra de domínio do motor (faixa, campo que não se aplica à classe, sandbox), com a mensagem dele.
- **Auditoria:** `catalog.update`, `target_type = asset`, `target_id` = id do ativo, `payload` = o patch; a recusa do motor grava `result = failed` com o motivo.

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

#### Cadastro de ativo novo (tarefa N.13)

Todas exigem `role = admin`. Proxy do motor (ver `.docs/engine/admin.md#cadastro-de-ativo-novo-tarefa-n13`, que descreve as quatro etapas, as classes e as faixas).

##### `POST /admin/catalog/preview`

- **Payload (JSON):** um formato por `kind`, validado por `newCatalogAssetBodySchema` (estrito, só formato): `acao` (`ticker`, `name`, `company_name`, `cnpj`, `sector`, `outstanding_shares`, `base_growth_pct`, `quality_multiplier`), `fii_tijolo` (`ticker`, `name`, `segment`, `vacancy_rate`), `fii_papel` (`ticker`, `name`, `indexador` `CDI` ou `IPCA+`), `etf` (`ticker`, `name`, `benchmark_index`, `methodology` opcional, `holdings: [{ ticker, weight_pct }]`).
- **Sucesso:** `200` → `{ kind, ticker, name, outstanding_shares | null, pool | null }`, com `pool = { pool_before, pool_after, new_bots, market_maker_shares, bot_shares, market_maker_id, creates_market_maker }` (nulo em ETF). Não grava nem audita.
- **Erros:** `400` — corpo fora do formato (o motor não é chamado); `409` — ticker ou CNPJ em uso; `422` — `{ error, field }` regra de domínio do motor.

##### `POST /admin/catalog`

- **Payload:** o mesmo do preview. O `admin_id` vem do token.
- **Sucesso:** `201` → `{ asset_id, preview }`.
- **Erros:** os do preview; `500` — `{ error, asset_id }` quando o catálogo gravou e a etapa dos bots ou da cobertura falhou (o ativo existe e aparece sem cobertura no painel de bots).
- **Auditoria:** `catalog.create`, `target_type = asset`, `target_id` = o ticker, `payload` = o pedido; recusa ou falha grava `result = failed` com o motivo.

### Comunicados e modo de manutenção (tarefa N.20)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Criar, editar e encerrar comunicado é auditado e **não** pede senha recente (não apaga dado de ninguém). A leitura que o app do usuário faz está em `GET /announcements` (`.docs/backend/announcements.md`). Tabela `announcements` (migration `0023`, sem backfill; `notify_by_email` na `0034`, padrão `false`).

Regras comuns: `title` 1 a 80 e `body` 1 a 280 caracteres (aparados); **texto puro**, `<` e `>` são recusados (o app exibe como texto, nunca como HTML); `severity` ∈ `info` | `warning` | `critical`; janela `[starts_at, ends_at)` (no instante do fim já saiu do ar), `ends_at` ausente ou `null` = até alguém encerrar, `starts_at` ausente = agora. `status` é derivado na leitura: `scheduled` | `active` | `ended`.

#### `GET /admin/announcements`

- **Sucesso:** `200` → `{ announcements: [{ id, title, body, severity, kind ('notice' | 'maintenance'), dismissible, notify_by_email, starts_at, ends_at | null, linked_halt_id | null, status, created_at }] }`, mais recente primeiro, até 100.

#### `POST /admin/announcements`

- **Payload (JSON):** `title`, `body`, `severity`, `dismissible` (padrão `true`), `notify_by_email` (padrão `false`), `starts_at`, `ends_at` (ISO 8601 com fuso), validados por `createAnnouncementBodySchema`. O criador vem do token.
- **Sucesso:** `201` → o comunicado. *(EM.5.2, E9.)* Com `notify_by_email: true` o comunicado também vai por e-mail (template `announcement`, categoria `transactional`, então não é opcional) a todas as contas **ativas, com e-mail verificado e não anonimizadas**; suspenso não recebe. O lote **sai uma vez, na criação**, mesmo para comunicado agendado (a manutenção programada avisa com antecedência e o e-mail traz a janela em horário de Brasília). A resposta não espera o lote: o enfileiramento roda em segundo plano, paginado por 200 usuários, um e-mail do outbox por (comunicado, usuário) (`announcement:<id>:<userId>`, idempotente). Cada e-mail ganha um horário de envio espaçado em `1000 / EMAIL_SEND_RPS` ms, então o lote vira uma fila comprida que não passa do limite do provedor, e um e-mail de segurança enfileirado no meio (reset de senha) sai antes do restante do lote em vez de esperar o fim. Falha ao iniciar o lote só é logada: o comunicado já está no ar. Editar (`PATCH`) nunca reenvia.
- **Erros:** `400` — formato (severidade fora da lista, data malformada); `422` — regra de domínio (tamanho, `<`/`>`, fim não posterior ao início, ou `notify_by_email` em comunicado que não é `critical`).
- **Auditoria:** `announcement.create`, `target_type = announcement`, `target_id` = id, `payload` = o que foi pedido; recusa grava `result = failed`.

#### `PATCH /admin/announcements/:id`

- **Payload:** os mesmos campos, todos opcionais, ao menos um; `ends_at: null` tira o fim. O **estado final** é validado (editar só o fim pra antes do início é `422`).
- **Sucesso:** `200` → o comunicado. **Erros:** `400`, `404`, `409` (aviso de manutenção não se edita, encerre e abra outro; comunicado que já terminou), `422`.
- **Auditoria:** `announcement.update`, `payload` só com o que foi pedido.

#### `POST /admin/announcements/:id/end`

- **Sucesso:** `200` → `{ announcement, outcome, halt_lifted }`. `announcement` é o estado **de antes** de encerrar. `outcome = ended` fixa o fim em agora (saiu do ar); `cancelled` quando ainda estava agendado (a linha é removida; fica a auditoria). `halt_lifted = true` quando havia pausa ligada à manutenção e ela foi levantada agora; pausa que já tinha sido levantada à mão não é erro (`false`).
- **Erros:** `400` id que não é UUID; `404`; `409` já terminou.
- **Auditoria:** `announcement.end`, `payload = { kind, outcome, halt_lifted }`; levantar a pausa gera também a linha `trading.resume` (N.9).

#### `POST /admin/maintenance`

- **Payload (JSON):** `title`, `body`, `ends_at` (opcional), `starts_at` (opcional), `pause_trading` (padrão `false`) e `notify_by_email` (padrão `false`, mesmo lote do comunicado crítico; a manutenção já nasce crítica), validados por `startMaintenanceBodySchema`.
- **Sucesso:** `201` → o aviso, sempre `kind = maintenance`, `severity = critical`, `dismissible = false`. Com `pause_trading`, abre antes a **pausa global de negociação** (N.9, mesma regra: ordem nova de usuário e de bot recusada, tick segue) e grava o id dela em `linked_halt_id`; encerrar a manutenção (`/end`) a levanta. Se o aviso falhar depois de a pausa abrir, a pausa é levantada de volta.
- **Erros:** `400` formato; `401 reauth_required` **só quando `pause_trading` é `true`** (mesma ação destrutiva da pausa); `409` já existe manutenção em aberto (ou já existe pausa global vigente); `422` regra de domínio, ou `pause_trading` junto com `starts_at` (a pausa vale já, então a manutenção também começa agora).
- **Auditoria:** `maintenance.start`, `payload = { title, body, starts_at, ends_at, pause_trading }` (mais `notify_by_email: true` quando pedido); com pausa, a linha `trading.halt` também é gravada.

### Integridade financeira e exportação CSV (tarefa N.21)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). O que a verificação confere, categoria por categoria, está em `.docs/engine/admin.md` (o motor reconstrói saldo e posição de `market_events` e compara com `accounts`/`positions`/float). **Somente leitura**: nenhuma rota corrige nada, corrigir é decisão humana.

#### `POST /admin/integrity/check`

- **Payload:** nenhum.
- **Sucesso:** `202` → `{ id, status: "running", started_at, finished_at: null, error: null, report: null }`. A verificação segue em segundo plano no motor (numa base com ~360 mil eventos leva menos de 1 s, mas o timeout é de 5 minutos).
- **Erros:** `409` já há uma em andamento (só uma por vez).
- **Auditoria:** `integrity.check`, `target_type = integrity_check`, `target_id` = id da verificação. Não pede senha recente (não altera nada).

#### `GET /admin/integrity/check`

- **Sucesso:** `200` → `{ run }`: `null` se nenhuma verificação rodou desde a subida do motor; senão `{ id, status ('running' | 'done' | 'failed'), started_at, finished_at | null, error | null, report | null }`. `report`: `{ checked: { events, accounts, positions, assets, resting_orders }, total, counts: { balance_mismatch, position_mismatch, negative_balance, negative_position, float_mismatch, resting_order_unfunded, unknown_event_type }, truncated, divergences: [{ kind, user_id | null, asset_id | null, ticker | null, order_id | null, expected, found, detail }] }`. Base consistente: `total = 0`. A lista detalhada vai até 200 itens (`truncated`), mas `counts` é sempre exato. O resultado é só o da última verificação e vive em memória no motor.

#### `GET /admin/exports/:dataset`

- **Conjuntos (`:dataset`):** `users`, `orders`, `market-events`, `audit-log`.
- **Payload (query), opcionais:** `from`/`to` (ISO 8601 com fuso, inclusivos, `from` ≤ `to`; o período é sobre `created_at` em usuários e ordens, `timestamp` nos eventos e `occurred_at` na auditoria), `limit` (inteiro ≥ 1; padrão 10.000, **teto 50.000**: acima do teto vira o teto). Validados por `exportQuerySchema`.
- **Sucesso:** `200` com `text/csv; charset=utf-8` e `Content-Disposition: attachment; filename="<conjunto>-AAAAMMDD.csv"`. Cabeçalhos `X-Export-Rows` (linhas no arquivo) e `X-Export-Truncated` (`true` se havia mais linhas que o limite: o arquivo traz as primeiras). CRLF entre linhas, BOM de UTF-8 na frente (o Excel abre os acentos certos). Células que começam com `=`, `+`, `-`, `@`, tab ou CR (e não são número) ganham apóstrofo na frente (CSV injection); `true`/`false` pros booleanos, ISO 8601 pras datas, vazio pro nulo.
- **Colunas (e a privacidade, RNF09 e LGPD):** `users`: `id, name, email, username, role, status, onboarding_completed, created_at`, **nunca** hash de senha, token, patrimônio nem rentabilidade. `orders`: `id, user_id, is_bot, ticker, side, type, quantity, filled_quantity, price, status, cancel_reason, simulated_day, created_at`. `market-events`: `id, user_id, is_bot, ticker, event_type, quantity, unit_value, simulated_day, timestamp`. `audit-log`: `id, occurred_at, admin_id, admin_username, action, target_type, target_id, result, error_message, payload` (JSON em texto; o `payload` já nasce sem dado sensível). Ordens e eventos identificam a conta só pelo id, nunca por nome ou e-mail.
- **Erros:** `400` conjunto desconhecido, data malformada, intervalo invertido, `limit` inválido (nada é lido nem auditado); `401 reauth_required` **só em `users`** (traz e-mail, dado pessoal: pede senha conferida nos últimos 5 minutos, como as ações destrutivas); `500` se o motor ou o banco falhar.
- **Auditoria:** `export.csv`, `target_type = export`, `target_id` = o conjunto, `payload = { dataset, from, to, limit, rows, truncated }`; falha de leitura grava `result = failed`.
