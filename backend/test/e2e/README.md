# Testes ponta a ponta (`test/e2e/`)

Tarefa 7.3 (`.claude/backlog-plataforma-investimentos.md`). Diferente de `npm test` (vitest sobre
`src/**/*.test.ts`, roteador+fakes em processo), esta suíte bate em HTTP real contra o **gateway**
(`http://localhost:8000` por padrão) — sem fake de motor nem de banco. Se qualquer serviço da stack
não estiver de pé, o teste falha por erro de conexão, não passa "verde" por acidente.

**Não roda no CI/lint padrão** (`npm run lint`/`npm test`/`npm run build` continuam sem essa pasta)
— precisa da stack inteira de pé e de um usuário `admin` pré-seedado, e pode levar vários minutos
(ver "Tempo de execução" abaixo).

## Precondição

1. Stack de pé: `docker compose up -d` na raiz do repo (Postgres, Redis, motor, backend, gateway).
2. Catálogo seedado (tarefa 7.2): `docker compose exec engine go run ./cmd/seed` (ou já seedado
   numa sessão anterior — o seed é idempotente).
3. Um usuário `admin` já existe no banco (`role = admin` nunca é atribuível por autocadastro,
   RNF07/CLAUDE.md). Se ainda não existir nenhum, crie um:

   ```
   DATABASE_URL=postgres://tcc:tcc@localhost:5432/gamification \
   ADMIN_EMAIL=e2e-admin@example.com \
   ADMIN_PASSWORD='SenhaForte123!' \
     npm run db:seed:admin
   ```

4. Rode a suíte informando as mesmas credenciais do passo 3:

   ```
   E2E_ADMIN_EMAIL=e2e-admin@example.com \
   E2E_ADMIN_PASSWORD='SenhaForte123!' \
     npm run test:e2e
   ```

   `E2E_BASE_URL` é opcional (default `http://localhost:8000`) — só precisa mudar se o gateway
   estiver mapeado numa porta diferente.

Usuários comuns são criados pela própria suíte via `POST /auth/register`, com e-mail/username
aleatórios a cada execução — ficam no banco de dev depois, mesmo padrão já aceito em toda validação
manual anterior (nunca um cleanup automático). Rodar a suíte de novo não conflita com a execução
anterior.

## Verificação de tipos (opcional, sem stack de pé)

`npm run typecheck:e2e` — `tsc --noEmit` isolado desta pasta (fora do `tsconfig.json`/`npm run
build` principal, que excluem `test/`).

## Execução sequencial (não paralela)

`vitest.e2e.config.mts` desliga `fileParallelism` de propósito — achado ao vivo desta sessão: as 3
jornadas avançam o **mesmo** relógio simulado global (`POST /admin/tick`, sem escopo por teste,
Mercado Ao Vivo é único). Rodando os 3 arquivos em paralelo (default do Vitest), um arquivo conferia
"mercado aberto" (`GET /market/clock`) e, antes da primeira chamada de escrita usar essa garantia,
outro arquivo já tinha avançado o relógio pro fim de semana simulado — `422 market_closed`
intermitente. Rodar em série elimina a corrida; o custo é só tempo de parede um pouco maior (ver
"Tempo de execução" abaixo).

## Jornadas cobertas

1. **`equityOrderJourney.e2e.test.ts`** — compra/venda de ação real, incluindo o `403` do gate de
   desbloqueio por lição (tarefa 7.0.1) antes de completar qualquer lição de Renda Variável.
   Completa lições reais via `POST /lessons/:id/progress` até `asset:acao` aparecer desbloqueado
   (hoje a lição `2.3`, resolvido dinamicamente via `unlocksKeys`, não hardcoded).
2. **`fixedIncomeRedemptionJourney.e2e.test.ts`** — aporte em CDB (gate `asset:cdb`), avanço de dias
   simulados via `POST /admin/tick` até sair da primeira faixa de IR regressivo (>180 dias
   corridos), resgate conferido contra a tabela fixa de IR (Lei 11.033/2004,
   `.docs/engine/fixedincome.md`) recalculada de forma independente no teste — não é reimplementar
   o motor, é conferir contra a mesma tabela documentada.
3. **`macroEventJourney.e2e.test.ts`** — dispara um template do catálogo (`macroevent.Templates`,
   spec 3.3.2) contra uma ação real do catálogo pós-7.2, avança ticks até o dia de relatório e
   confirma o evento aparecendo no feed (`GET /news`) com `status: aplicado`.
4. **`companyQualityJourney.e2e.test.ts`** — achado 025 (`companies.quality_multiplier`): lê o
   `indicators` de todas as ações reais (`GET /market/assets/:id`) e confere que, em cada um dos 6
   setores, ROE, margem líquida, margem EBIT e P/VP variam entre empresas (Boa > Ruim), nos
   fundamentos do seed e de novo depois de um ciclo de relatório de 91 dias simulados, com o ROE de
   cada empresa estável entre os dois momentos. **Precondição própria:** banco de mercado seedado
   _depois_ da migration 000039 (`ensureCompany` pula empresa existente, então um banco antigo fica
   com multiplicador 1.00 e este teste falha de propósito, apontando o seed desatualizado).

## Sobre `POST /admin/tick`

Até esta tarefa, `POST /admin/tick` só existia na rede interna do Compose (`engine:8080`), nunca
alcançável do host nem do gateway — comentário de `handleAdminTick` em
`engine/internal/infra/httpserver/admin.go` já antecipava isso ("a restrição role=admin fica a
cargo de quem expuser esta rota publicamente... quando o painel admin existir"). Decisão confirmada
com o autor em 2026-09-28: em vez de expor a porta do motor ao host ou contornar via `docker exec`,
esta tarefa criou o proxy `POST /admin/tick` (admin-only) no backend — ver
`.docs/backend/admin.md`. A suíte usa esse proxy pra avançar dias simulados, nunca fala com o motor
direto.

## Tempo de execução

Pode levar **vários minutos** (não é regressão de performance, é o mecanismo real sendo exercitado
sem atalho):

- Completar uma lição respeita `LESSON_MIN_STEP_INTERVAL_MS` (default 5000ms) entre passos —
  desbloquear `asset:acao` (lição `2.3`, sortOrder 19 hoje) percorre ~19 lições.
- A jornada de evento macro avança ticks até o dia de relatório (ciclo global de 91 dias,
  `fundamentals.DefaultReportFrequencyDays`) — pode ser até ~91 ticks dependendo do dia simulado
  corrente do banco de dev; cada tick em si é rápido (sub-segundo a poucos segundos, cresce com o
  tamanho do catálogo — ver `proposta-cobertura-market-maker.md`), o tempo mesmo é dominado pelas
  esperas de lição acima.

`vitest.e2e.config.mts` define `testTimeout`/`hookTimeout` generosos (20 min) por isso — o custo por
tick também cresce com o total de dias simulados já acumulados no banco (mais linhas de
`market_events`/histórico pra ler a cada tick), então quanto mais essa suíte já rodou contra o mesmo
volume Postgres, mais lenta a próxima execução tende a ficar (validado nesta sessão: ~4s/tick com
o dia simulado já em ~1500). Um volume novo (`docker compose down -v && up -d`, seção abaixo) volta
o custo por tick a poucos milissegundos.

## Resetar entre execuções

Não é necessário resetar nada — cada execução cria seus próprios usuários (e-mail aleatório).
Se quiser mesmo assim um banco limpo: `docker compose down -v && docker compose up -d` (apaga todos
os volumes, inclusive dados reais que você queira manter) e repita a precondição acima (seed do
catálogo + seed do admin) antes de rodar a suíte de novo.
