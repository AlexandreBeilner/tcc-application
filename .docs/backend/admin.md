# `admin` — rotas restritas a papel administrativo

Módulo: `backend/src/modules/admin/`. `GET /admin/ping` é rota de exemplo; `POST /admin/macro-events` (tarefa 4.4) e `GET /admin/macro-events` (tarefa 4.5) formam o painel administrativo de Eventos Macro (RF13/RF14, tela 10.1/10.2 do inventário). Outros painéis administrativos chegam na semana 6 e são documentados aqui quando existirem.

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
- **Payload:** repassado praticamente sem tradução pro motor (mesmos nomes de campo, snake_case) — ver `.docs/engine/macroevent.md` pro formato completo (`template_key` opcional; evento avulso exige `title`/`narrative`/`direction`/`magnitude_band`/`affects_price`/`affects_fundamentals`; `targets`, mínimo 1, cada um com exatamente um entre `sector`/`risk_class`/`asset_id`). Validado com `interfaces/http/schemas.ts` (`triggerMacroEventBodySchema`, união de duas variantes — template ou avulso) antes de chamar o caso de uso.
- **Sucesso:** `201` → `{ event: {...} }`, corpo de `event` idêntico à resposta de `POST /macro-events` do motor (id, efeitos já amostrados, `fundamentals_report_day` se aplicável, `targets` — array de `{ sector? | risk_class? | asset_id? }` refletindo os alvos persistidos, exatamente um campo preenchido por item).
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — corpo não bate com nenhuma das duas variantes do schema (campo obrigatório ausente, alvo com escopo ambíguo etc.) **ou** o motor rejeitou o evento por uma regra que só ele sabe validar (ex: `template_key` inexistente no catálogo) — dupla validação documentada (Zod na borda + `macroevent.NewEvent`/`NewTarget` no motor), não redundância acidental.
- **Regra:** `TriggerMacroEventUseCase` delega inteiramente pra `MacroEventTrigger` (porta) → `engineMacroEventTrigger` (adapter, chama `POST /macro-events` via `ENGINE_URL`) — a regra de negócio do disparo (sorteio de efeito por banda, defasagem preço↔fundamentos) vive toda no motor; este módulo só garante `role = admin` (RNF07) antes de repassar. Um `400` do motor é traduzido pelo adapter em `InvalidMacroEventError` (`domain/errors.ts`), mapeado de volta pra `400` pelo router — qualquer outra falha do motor (`500`+) propaga como erro genérico (`500`, tratamento padrão do Express).

### `GET /admin/macro-events`

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** query string — `limit` (opcional, inteiro 1–100) e `offset` (opcional, inteiro ≥ 0), validados por `interfaces/http/schemas.ts` (`listMacroEventsQuerySchema`, `z.coerce.number()` já que query chega como string). Ambos repassados como estão pro motor; ausentes, o motor aplica o próprio default (ver `.docs/engine/macroevent.md`).
- **Sucesso:** `200` → `{ events: [...] }`, cada item idêntico à resposta de `POST /admin/macro-events` (mesmo formato de `event`, `targets` incluído) — inclui `status` já atualizado (`pendente`/`aplicado`), não um valor congelado da criação (tarefa 4.5: o Temporizador atualiza a coluna a cada tick, ver `.docs/engine/macroevent.md#get-macro-events` e `.docs/engine/tick.md`).
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — `limit`/`offset` fora da faixa aceita (ex: `limit=0`, `limit=101`, `offset=-1`, valor não numérico).
- **Regra:** `ListMacroEventsUseCase` delega inteiramente pra `MacroEventReader` (porta) → `engineMacroEventReader` (adapter, chama `GET /macro-events` via `ENGINE_URL`, repassando `limit`/`offset` como query string) — nenhuma regra de negócio própria, mesmo padrão de delegação fina de `TriggerMacroEventUseCase`. Não expõe patrimônio nem dado de conta de usuário — evento macro é estado global do motor (Mercado Ao Vivo único), não por conta (CLAUDE.md).
