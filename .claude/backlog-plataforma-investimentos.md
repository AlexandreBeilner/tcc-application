# Backlog — Plataforma Gamificada de Investimentos

> Quebra de tarefas a partir de `especificacao-plataforma-investimentos.md` (v0.5) e `inventario-telas-plataforma-investimentos.md`. Organizado pelas 8 semanas já definidas no roadmap (spec seção 10) — aqui cada semana vira uma lista de tarefas executáveis, cada uma pensada como um escopo razoável de sessão de trabalho com Claude Code.

**Como ler cada tarefa:** título · descrição curta · critérios de aceite · referências (RF/RNF, entidades do DER, telas do inventário) · dependências.

---

## Semana 1 — Fundação

### 1.0 · Identidade visual ✅ concluída
- **Descrição:** definir o sistema de design que vai guiar todas as telas — paleta de cores, tipografia, escala de espaçamento, tom visual (equilibrando "confiável" — dado financeiro — com "lúdico" — gamificação). Resultado: um documento curto de tokens, não mockups de telas.
- **Critérios de aceite:** paleta definida (cores primárias e secundárias, tema claro e escurro, semânticas de ganho/perda, estados de bloqueio/desbloqueio da trilha); tipografia (família, escala); espaçamento (grid/escala); tom (ex: cores de alerta discretas, não agressivas, dado o cuidado com bem-estar financeiro do usuário).
- **Dependências:** nenhuma — pode rodar em paralelo ao resto da semana 1.
- **Entregável:** `.claude/identidade-visual-tokens.md`.

### 1.1a · Setup do Motor de Simulação (Go) ✅ concluída
- **Descrição:** inicializar o projeto Go do motor de simulação — módulo (`go mod init`), estrutura de pastas (domínio separado de infraestrutura, já pensando em Event Sourcing), linter (`golangci-lint`), framework HTTP escolhido, Dockerfile próprio. **Roda em container** (ver 1.2).
- **Critérios de aceite:** `go build` e `go test` rodam sem erro num projeto vazio; endpoint de health check responde; imagem builda via Dockerfile próprio e sobe via `docker run` isolado.
- **Referências:** spec seção 3 (motor de simulação isolado), TCC cap. 7.2.3.
- **Dependências:** nenhuma — pode rodar em paralelo a 1.1b/1.1c/1.0.
- **Entregável:** `engine/` — módulo `tcc-investimentos/engine`, `cmd/api` + `internal/domain`/`internal/infra/httpserver`, `.golangci.yml`, `Dockerfile` multi-stage (build validado, `/health` respondendo em container isolado).

### 1.1b · Setup do Backend Gamificado (Node.js/TypeScript) ✅ concluída
- **Descrição:** inicializar o backend gamificado — projeto Node.js com TypeScript, framework HTTP escolhido, estrutura de pastas, lint/format (ESLint/Prettier), configuração de testes, Dockerfile próprio. **Roda em container** (ver 1.2).
- **Critérios de aceite:** `npm run build`/`npm test` rodam sem erro num projeto vazio; endpoint de health check responde; imagem builda via Dockerfile próprio e sobe via `docker run` isolado.
- **Referências:** spec seção 3 (backend plataforma gamificada), TCC cap. 7.2.3.
- **Dependências:** nenhuma — pode rodar em paralelo a 1.1a/1.1c/1.0.
- **Entregável:** `backend/` — Express + TypeScript, `src/app.ts`/`src/server.ts`/`src/routes`, ESLint (flat config) + Prettier, Vitest + Supertest, `Dockerfile` multi-stage (build validado, `/health` respondendo em container isolado).

### 1.1c · Setup do Frontend (React/TypeScript) ✅ concluída
- **Descrição:** inicializar o frontend — React + TypeScript (Vite ou equivalente), estrutura de pastas, lint/format, configuração de testes, roteamento básico. **Não roda em container** — segue como servidor de desenvolvimento local (e, em produção, como build estático servido fora do Docker Compose).
- **Critérios de aceite:** projeto builda e serve localmente via `npm run dev`; página inicial em branco renderiza sem erro; nenhum Dockerfile criado para este serviço.
- **Referências:** spec seção 3 (frontend gamificado), TCC cap. 7.2.3.
- **Entregável:** `frontend/` — Vite + React 19 + TypeScript, `react-router-dom` (rota `/` → `Home`), oxlint + Prettier, Vitest + Testing Library, `npm run dev`/`build` validados, sem Dockerfile.
- **Dependências:** nenhuma — pode rodar em paralelo a 1.1a/1.1b/1.0.

### 1.2 · Docker Compose (Postgres, Redis, motor de simulação, backend gamificado) ✅ concluída
- **Descrição:** ambiente de containers cobrindo **todo o backend** — os dois bancos (persistência poliglota, spec seção 3) e os dois serviços de aplicação (1.1a, 1.1b), cada um com seu próprio Dockerfile. O frontend fica de fora do Compose, por decisão explícita.
- **Critérios de aceite:** `docker compose up` sobe Postgres (dois schemas/bancos lógicos — usuário/gamificação e mercado), Redis, motor de simulação e backend gamificado, todos containerizados; nenhum desses quatro serviços roda fora de container em nenhum ambiente.
- **Dependências:** 1.1a, 1.1b.
- **Entregável:** `docker-compose.yml` na raiz + `infra/postgres/init/01-create-databases.sql` (cria `gamification` e `market` como bancos lógicos separados no mesmo Postgres); `.env.example` com credenciais padrão. Validado: os 4 serviços sobem saudáveis, `/health` do engine e do backend respondem via porta publicada, Redis responde a `PING`, os dois bancos existem.

### 1.1d · Comunicação entre os serviços ✅ concluída
- **Descrição:** validar que o frontend (rodando local, fora de container) conversa com o backend inteiro (rodando via Docker Compose) através do proxy reverso (gateway), conforme diagrama de arquitetura (spec seção 3, TCC Fig. 1) — frontend → proxy reverso → backend gamificado → motor de simulação.
- **Critérios de aceite:** requisição de teste feita pelo frontend local chega até o motor de simulação containerizado e volta, passando pelo proxy reverso e pelo backend gamificado.
- **Dependências:** 1.2, 1.1c.
- **Entregável:** `gateway/` — nginx como porta de entrada única do backend (`docker-compose.yml` atualizado: `engine`/`backend` sem porta publicada no host, só `expose`; só `gateway` publica `8000:80`). Backend ganhou `GET /status` (`src/infra/engineClient.ts` + `src/routes/status.ts`) que consulta o engine via `ENGINE_URL` e reporta os dois saltos. Frontend ganhou proxy do Vite (`vite.config.ts`, `server.proxy` para `/health` e `/status` apontando pro gateway). Validado: `curl` a partir do dev server local (`localhost:15173/status`) retornou `{"backend":"ok","engine":"ok"}`, provando a cadeia completa frontend local → gateway → backend → engine → volta.

### 1.3 · Migrations do DER completo ✅ concluída (schema) · ⚠️ diagrama dbdiagram.io pendente
- **Descrição:** criar todas as tabelas do modelo de dados — DER original do TCC (users, user_identities, achievements, user_achievements, accounts, positions, assets, fixed_income_assets, variable_income_assets, companies, company_fundamentals, order_book, market_events) **+ extensões da spec v0.3–v0.5**: `lessons`, `user_lesson_progress`, `macro_events`, `macro_event_targets`, `dividend_events`, `username`/`role` em `users`, `friendships`, `etf_details`, `etf_holdings`, `fii_details`, `daily_missions`, `user_mission_progress`.
- **Critérios de aceite:** migrations aplicam sem erro; DER atualizado (diagrama) reflete o que está em `dbdiagram.io`, não só o schema.
- **Referências:** spec seção 4 (tabela completa de extensões).
- **Dependências:** 1.2.
- **Entregável:** `.claude/der-original-tcc.md` (DER original transcrito + seção "Divergências assumidas" documentando cada desvio do schema literal). Banco `market` (engine, `golang-migrate` embutido, roda sozinho na subida): `engine/internal/infra/db/migrations/000001_init_market_schema.{up,down}.sql`, 15 tabelas + `schema_migrations`. Banco `gamification` (backend, Drizzle ORM, `drizzle-kit generate` + `migrate()` na subida): `backend/src/db/schema.ts` + `backend/src/db/migrations/`, 9 tabelas. Validado via `docker compose up`: as duas migrations aplicam automaticamente, `CHECK` constraints de `fii_details` e `macro_event_targets` testados manualmente (insert inválido rejeitado corretamente), lint (`golangci-lint`, `eslint`) e testes de ambos os serviços passando.
- **Pendente:** atualizar o diagrama em `dbdiagram.io` — é uma ferramenta externa que não tenho acesso; `.claude/der-original-tcc.md` documenta o schema completo em texto como substituto até alguém atualizar o diagrama manualmente.

### 1.4 · Autenticação com papel admin/usuário ✅ concluída
- **Descrição:** cadastro/login por e-mail e OAuth Google, JWT, distinção de papel (`role`).
- **Critérios de aceite:** rotas protegidas retornam 401/403 corretamente; `role = admin` só atribuível manualmente (seed), nunca por autocadastro.
- **Referências:** RNF07; tela 1.1 (Autenticação) do inventário.
- **Dependências:** 1.3.
- **Entregável (refatorado pra DDD lite — ver `.claude/arquitetura-backend-ddd-lite.md`, decisão pós-1.4):** `backend/src/modules/auth/` — `domain/` (`User`, erros de negócio), `application/ports/` (`UserRepository`, `PasswordHasher`, `TokenIssuer`, `GoogleIdentityProvider`), `application/useCases/` (`RegisterUserUseCase`, `LoginUserUseCase`, `GetCurrentUserUseCase`, `LoginWithGoogleUseCase`), `infrastructure/` (`bcryptPasswordHasher`, `jwtTokenIssuer`, `googleIdentityProviderAdapter` com fallback "desabilitado" sem credenciais, `drizzleUserRepository`), `interfaces/http/` (`schemas.ts` com Zod, `authRouter.ts`: `POST /auth/register` sempre `role: 'user'` — Zod descarta `role` do corpo —, `POST /auth/login`, `GET /auth/google` + `/callback`, `GET /auth/me`), `test/fakes/` (fake de cada port). `backend/src/modules/admin/interfaces/http/pingRouter.ts`: `GET /admin/ping` de exemplo, protegida por `shared/http/authMiddleware.ts` (cross-cutting, usado por qualquer módulo). `backend/src/db/seed.ts` (`npm run db:seed:admin`): único caminho pra criar `role: 'admin'`, idempotente. `backend/src/app.ts` é a composição (injeção de dependência de todas as ports). `docker-compose.yml`/`.env.example`: `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `FRONTEND_URL`. `frontend/vite.config.ts`: proxy de `/auth`. Validado via `docker compose up` + `curl` através do gateway (mesmos cenários da validação original: role forjada ignorada, 401/403/200 em `/admin/ping`, seed idempotente) e via 46 testes Vitest (casos de uso com fakes, adapters de infraestrutura, middleware, routers), lint e build passando.
- **Nota:** fluxo `GET /auth/google` depende de `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` reais (Google Cloud Console) — não testável de ponta a ponta sem essas credenciais, que o usuário precisa gerar e colocar no `.env`; cadastro/login por e-mail não dependem disso.

### 1.5 · Capital inicial padronizado ✅ concluída
- **Descrição:** toda conta nova nasce com `accounts.current_balance = R$ 10.000,00` no mercado ao vivo.
- **Critérios de aceite:** conta criada via 1.4 já vem com o saldo padrão, testado por teste automatizado.
- **Referências:** RNF06, spec seção 3.5.
- **Dependências:** 1.3, 1.4.
- **Entregável:** `engine/internal/domain/account/` — `Account`/`InitialBalance = 10000.00` (fixado no domínio, RNF06) e `Service.Open`, injetado com uma `Repository` (interface pequena, ver `.claude/arquitetura-engine-go.md`). `engine/internal/infra/db/account_repository.go` implementa essa `Repository` contra o banco `market`: grava o evento imutável `initial_deposit` em `market_events` e só então projeta a linha em `accounts`, na mesma transação (Event Sourcing, CLAUDE.md) — a migration `000002_market_events_deferrable_user_fk` tornou a FK `market_events.user_id → accounts.user_id` `DEFERRABLE INITIALLY DEFERRED` pra permitir essa ordem sem abrir mão da integridade referencial. Novo endpoint interno `POST /accounts` (`engine/internal/infra/httpserver/account.go`, documentado em `.docs/engine/account.md`), chamado pelo backend via `AccountProvisioner` (port em `backend/src/modules/auth/application/ports/`, adapter `infrastructure/engine/engineAccountProvisioner.ts`) a partir de `RegisterUserUseCase` e de `LoginWithGoogleUseCase` (só no caminho de usuário novo). Testes: `account_test.go` (domínio, com fake repository), `account_test.go` (handler HTTP, com fake `accountOpener`), `engineAccountProvisioner.test.ts` (adapter, mockando `fetch`), casos novos em `registerUser.test.ts`/`loginWithGoogle.test.ts`/`authRouter.test.ts`. Validado via `docker compose up` + `curl` através do gateway: `POST /auth/register` criou a conta no banco `market` com `current_balance = 10000.00` e o evento `initial_deposit` correspondente; chamada direta duplicada em `POST /accounts` retornou `409`; `user_id` inválido retornou `400`. `golangci-lint run` (0 issues), `go build`/`go test ./...`, `npm run lint`/`build`/`test` (50 testes) passando.

---

## Semana 2 — Motor de Renda Fixa

### 2.1 · Event Sourcing (log append-only) ✅ concluída
- **Descrição:** implementar `market_events` como fonte de verdade — toda operação financeira grava um evento imutável antes de projetar o estado.
- **Critérios de aceite:** nenhuma escrita de saldo/posição acontece sem um evento correspondente gravado antes.
- **Referências:** RNF01 (TCC), spec seção 3.4.
- **Dependências:** 1.3.
- **Entregável:** `engine/internal/domain/eventstore.go` — `MarketEvent` (`UserID`, `AssetID *string`, `EventType`, `Quantity *int`, `UnitValue *float64`) e `EventStore` (interface pequena, um método `Append`, ver `.claude/arquitetura-engine-go.md`); `MarketEventType` espelha o enum Postgres `market_event_type` como constantes tipadas (`EventInitialDeposit`, `EventBuyOrderExecuted`, `EventSellOrderExecuted`, `EventFixedIncomePurchase`, `EventFixedIncomeRedemption`, `EventDividendPayment`), com teste (`eventstore_test.go`) travando cada valor contra o enum do banco. `engine/internal/infra/eventstore/postgres.go` — `PostgresEventStore` implementa `domain.EventStore` contra o banco `market`; `AppendTx(ctx, tx, event)` (função exportada, não amarrada à interface) permite gravar o evento dentro de uma transação já aberta por outro repositório, necessário pra atomicidade evento+projeção já que `domain` não pode importar `database/sql`. `engine/internal/infra/db/account_repository.go` (tarefa 1.5) refatorado pra usar `eventstore.AppendTx` no lugar do INSERT solto em `market_events` — primeiro repositório real a passar pelo padrão. Migration `000003_market_events_append_only` acrescenta um trigger Postgres (`prevent_market_events_mutation`) que bloqueia `UPDATE`/`DELETE` em `market_events` — log append-only garantido pelo próprio banco, não só por disciplina de código. Testes: `eventstore_test.go` (domínio), `postgres_test.go` (adapter, com fake `execer` capturando query/args). Validado via `docker compose up` + `curl` através do gateway: `POST /auth/register` gravou o evento `initial_deposit` e projetou `accounts.current_balance = 10000.00` corretamente; `UPDATE`/`DELETE` direto em `market_events` via `psql` retornaram erro do trigger. `golangci-lint run` (0 issues, golangci-lint v2 — a v1.x não interpreta o schema `version: "2"` do `.golangci.yml` e falsopositiva o depguard em todo o projeto), `go build`/`go test ./...` passando.

### 2.2 · Selic simulada ✅ concluída
- **Descrição:** processo estocástico para a taxa básica simulada, base para precificação de renda fixa pós-fixada.
- **Critérios de aceite:** série gerada é determinística por seed (RNF08 — sandbox), auditável.
- **Dependências:** 2.1.
- **Entregável:** `engine/internal/domain/selic/selic.go` — `Series(cfg Config, steps int) []float64`, função pura (sem I/O, sem colaborador externo — não precisou de interface/port) que gera a série de Selic simulada (% a.a.) via reversão à média discretizada (Ornstein-Uhlenbeck simplificado — precursor do Vasicek completo + calendário Copom da tarefa 3.3, que depende desta). `Config{Initial, Neutral, ReversionSpeed, Volatility, Seed}` + `DefaultConfig(initial, seed)` com os parâmetros de referência da spec 3.2.2 (`Neutral = 10.0`, i.e. 10% a.a.) — mantidos como default ajustável, não constante travada, porque a spec já prevê calibração fina na semana 8. Mesmo `Config`+`Seed` sempre reproduz a mesma série byte a byte (`rand.New(rand.NewSource(seed))`), satisfazendo determinismo do sandbox (RNF08) e auditabilidade (a série é recalculável a qualquer momento a partir dos parâmetros usados); taxa nunca fica negativa. Testes table-driven (`selic_test.go`): reversão à média sem ruído com valores numéricos exatos conferidos à mão, determinismo por seed, seeds diferentes gerando séries diferentes, não-negatividade sob 1000 passos, `steps` não positivo retornando `nil`, `DefaultConfig`. Sem porta HTTP nova (função de domínio pura, consumida pelas tarefas de precificação 2.3+) — validado que o motor builda e sobe normalmente em container via `docker compose up` (`/status` respondendo `{"backend":"ok","engine":"ok"}`). `golangci-lint run` (0 issues, golangci-lint v2), `go build`/`go test ./...` passando.

### 2.3 · Tesouro Prefixado (deságio) ✅ concluída
- **Descrição:** implementar a fórmula de precificação por deságio (TCC eq. 5, cap. 2.2.1).
- **Critérios de aceite:** teste unitário reproduz exemplo numérico do TCC com margem de erro < 0,01.
- **Dependências:** 2.2.
- **Entregável:** `engine/internal/domain/fixedincome/prefixado.go` — `PrefixedPrice(annualRate float64, businessDaysToMaturity int) float64`, função pura implementando a eq. 5 do TCC (cap. 2.2.1): `Preço = VN / (1 + Taxa)^(DU/252)`. `FaceValue = 1000.00` (Valor Nominal do Tesouro Prefixado no vencimento, fixo por definição do título, não configurável) e `BusinessDaysPerYear = 252` (mesma base de dias úteis que a spec 3.2 usa pra conversão de volatilidade do GBM, semana 3) como constantes do pacote — `internal/domain/fixedincome` é o pacote que a própria `.claude/arquitetura-engine-go.md` já antecipava pra abrigar as fórmulas de renda fixa das tarefas 2.3–2.5. **Nota sobre o critério de aceite:** o TCC documenta só a fórmula abstrata da eq. 5, sem um exemplo numérico calculado no texto (conferido lendo o PDF original do TCC) — decisão do usuário: usar um exemplo didático padrão de mercado construído a partir da própria equação (VN=R$1.000, taxa 10% a.a., DU=252 → Preço ≈ R$909,09), documentado no teste como não sendo um número literal do texto do TCC. Testes (`prefixado_test.go`, todos com margem < 0,01): exemplo de referência, tabela com taxa zero (sem deságio), vencimento hoje (DU=0), meio ano útil, dois anos úteis, e uma verificação de que o preço nunca excede o Valor Nominal com taxa positiva. Sem porta HTTP nova (função de domínio pura, ainda sem consumidor — será usada por 2.4 marcação a mercado e pelas futuras rotas de compra); validado que o motor builda e sobe normal em container via `docker compose up` (`/status` respondendo `{"backend":"ok","engine":"ok"}`). `golangci-lint run` (0 issues, golangci-lint v2), `go build`/`go test ./...` passando.

### 2.4 · Marcação a mercado ✅ concluída
- **Descrição:** implementar reprecificação de título a cada dia útil conforme variação de taxas (TCC cap. 2.2.3).
- **Critérios de aceite:** resgate antecipado reflete corretamente ganho/perda em relação à taxa contratada.
- **Dependências:** 2.3.
- **Entregável:** `engine/internal/domain/fixedincome/markingtomarket.go` — `EarlyRedemption(purchasePrice, purchaseRate, currentMarketRate float64, remainingBusinessDays int) EarlyRedemptionResult`, função pura que reaplica a mesma fórmula de deságio (`PrefixedPrice`, tarefa 2.3) com a taxa de mercado vigente pra marcar o título a mercado no dia do resgate — a "reprecificação a cada dia útil" do cap. 2.2.3 é literalmente essa fórmula reaplicada dia a dia com o DU restante encolhendo e a taxa podendo ter mudado; não precisou de mecanismo de calendário/agendamento (isso é o ator Temporizador, ainda não implementado nas semanas 1-2). `EarlyRedemptionResult{MarkToMarketPrice, RealizedReturnPct, VsContractedRate}` — `RealizedReturnPct` é o retorno total desde a compra; `VsContractedRate` isola o efeito só da mudança de taxa, comparando o preço de mercado hoje com o preço que o título teria hoje se a taxa contratada não tivesse mudado (positivo = ganho extraordinário se os juros caíram, negativo = rentabilidade inferior à contratada se subiram — os dois cenários literais do TCC cap. 2.2.3). Testes (`markingtomarket_test.go`): os dois cenários do TCC (taxa subiu → `VsContractedRate` negativo mas ainda com `RealizedReturnPct` positivo, ganho extraordinário quando cai), taxa inalterada → `VsContractedRate` ≈0, ordem monotônica dos três cenários, e uma tabela com valores numéricos exatos conferidos via Python. Sem porta HTTP nova (função de domínio pura, ainda sem consumidor — será usada pela futura rota de resgate); validado que o motor builda e sobe normal em container via `docker compose up`. `golangci-lint run` (0 issues, golangci-lint v2), `gofmt -l` limpo, `go build`/`go test ./...` passando.

### 2.5 · CDB/LCA/LCI/CRI/CRA e campos de produto ✅ concluída
- **Descrição:** modelar os demais produtos de renda fixa com os campos novos da spec — `tax_exempt`, `credit_risk_rating`, `issuer_type`.
- **Critérios de aceite:** cada produto expõe corretamente os três campos; LCI/LCA aparecem como isentos de IR.
- **Referências:** análise de telas — tela 4.2 (Lista de Renda Fixa).
- **Dependências:** 2.4.
- **Entregável:** `engine/internal/domain/fixedincome/product.go` — `ProductType` (espelha os 8 valores de renda fixa do enum Postgres `asset_type`: `tesouro_selic/prefixado/ipca`, `cdb`, `lci`, `lca`, `cri`, `cra`) e `IssuerType` (espelha o enum `issuer_type`). `NewFixedIncomeProduct(productType, creditRiskRating) (FixedIncomeProduct, error)` deriva `IssuerType` e `TaxExempt` sempre a partir do tipo do produto via uma tabela de classificação interna (nunca recebidos soltos) — Tesouro é do governo e tributado; CDB é de banco e tributado; LCI/LCA são de banco e isentos de IR; CRI/CRA são de securitizadora e isentos de IR (spec seção 4). `RequiresCreditRiskRating(productType)` formaliza a regra de que só CRI/CRA exigem `credit_risk_rating` preenchido — não têm a garantia do FGC que protege CDB/LCI/LCA até um limite, e Tesouro é soberano (currículo, lição 1.9); `NewFixedIncomeProduct` recusa criar CRI/CRA sem essa classificação (`ErrMissingCreditRiskRating`) e recusa tipo desconhecido (`ErrUnknownProductType`). Testes (`product_test.go`): tabela cobrindo os 8 tipos com o `IssuerType`/`TaxExempt` esperado de cada um, tipo desconhecido, CRI/CRA sem rating rejeitados, Tesouro/CDB/LCI/LCA sem rating aceitos, `RequiresCreditRiskRating` para os 8 tipos. Sem porta HTTP nova (função de domínio pura, ainda sem consumidor — será usada pelo seed do catálogo de ativos, semana 7); validado que o motor builda e sobe normal em container via `docker compose up`. `golangci-lint run` (0 issues, golangci-lint v2), `gofmt -l` limpo, `go build`/`go test ./...` passando.

### 2.6 · Testes unitários das fórmulas ✅ concluída
- **Descrição:** cobertura de todas as fórmulas do motor de renda fixa.
- **Critérios de aceite:** suíte de testes alinhada ao cap. 7.2.4 do TCC, rodando em CI.
- **Dependências:** 2.1–2.5.
- **Entregável:** Auditoria de cobertura confirmou (`go test ./... -cover`) que os pacotes de fórmula das tarefas 2.1–2.5 já estavam com 100% de cobertura de statements desde que cada tarefa foi implementada, com testes sempre criados junto (não depois) — `internal/domain/fixedincome` 100% (`PrefixedPrice`, `EarlyRedemption`, `NewFixedIncomeProduct`/`RequiresCreditRiskRating`), `internal/domain/selic` 100% (`Series`), `internal/domain/account` 100%; nenhuma fórmula nova precisou ser escrita nesta tarefa. **CI (parte que faltava):** `.github/workflows/engine-ci.yml` — primeiro pipeline de CI do projeto, escopo restrito a `engine/**` via `paths` (backend/frontend ficam de fora, sem task própria de CI ainda no backlog). Job único rodando em `ubuntu-latest`: `gofmt -l` (falha se algo estiver fora do padrão), `go vet ./...`, `golangci-lint run` via imagem Docker `golangci/golangci-lint:v2.12.2` pinada (não `:latest` — reprodutibilidade; v2, não v1, porque v1.x não interpreta o schema `version: "2"` de `.golangci.yml` e falso-positiva o depguard em todo o projeto, problema já encontrado e documentado nas tarefas 2.1–2.5), `go build ./...`, `go test ./... -cover -v`. Dispara em push pra `main` e em pull requests que tocam `engine/**`. Todos os passos validados localmente antes de existirem no workflow, reproduzindo exatamente os comandos que o CI vai rodar. Não foi criada uma nova fórmula de imposto de renda (tabela regressiva de IR) — isso é conteúdo de lição (currículo, semana 7), não uma fórmula do motor pedida por nenhuma tarefa até aqui; `tax_exempt` (tarefa 2.5) já cobre a distinção binária isento/tributado que o motor precisa.

---

## Semana 3 — Motor de Renda Variável e Fundamentos

### 3.1 · GBM por `risk_class`
- **Descrição:** movimento browniano geométrico para geração de preços de ações, parametrizado por classe de risco.
- **Critérios de aceite:** séries geradas com volatilidade coerente por `risk_class`; determinísticas por seed.
- **Dependências:** 2.1.

### 3.2 · Order book (matching engine)
- **Descrição:** motor de pareamento de ordens por prioridade de preço e tempo (TCC cap. 2.3.1).
- **Critérios de aceite:** ordens de mesmo preço executam na ordem de chegada; ordens a mercado casam contra a melhor oferta.
- **Referências:** RF04.
- **Dependências:** 3.1.

### 3.3 · Curva de juros (Vasicek) + calendário Copom
- **Descrição:** modelo de taxa de juros de curto prazo com reuniões simuladas a cada 21 dias.
- **Critérios de aceite:** curva reage a "decisões" simuladas do Copom, refletindo no preço da renda fixa pós-fixada.
- **Dependências:** 2.2.

### 3.4 · IPCA sintético (VNA)
- **Descrição:** série de inflação simulada, usada para atualizar o Valor Nominal Atualizado do Tesouro IPCA+ (TCC eq. 6 e 7).
- **Critérios de aceite:** VNA projetado bate com o exemplo numérico do TCC.
- **Dependências:** 3.3.

### 3.5 · Geração de fundamentos com fator Selic
- **Descrição:** série de `company_fundamentals` correlacionada à Selic simulada, para dar coerência macro aos balanços sintéticos.
- **Critérios de aceite:** empresas de setores sensíveis a juros mostram fundamentos que reagem de forma plausível a mudanças de Selic.
- **Dependências:** 2.2, 3.1.

### 3.6 · Ciclo de relatórios (14 dias)
- **Descrição:** cadência de divulgação de resultados trimestrais simulados.
- **Critérios de aceite:** `report_frequency_days` respeitado; preço reage à expectativa antes, ao resultado depois (RF15).
- **Dependências:** 3.5.

### 3.7 · Especialização de ETFs
- **Descrição:** `etf_details` (índice de referência, metodologia) + `etf_holdings` (composição sintética).
- **Critérios de aceite:** cada ETF tem um índice associado e uma lista de constituintes com peso somando ~100%.
- **Referências:** RF21, spec seção 3.6.
- **Dependências:** 3.1.

### 3.8 · Especialização de FIIs (tijolo/papel)
- **Descrição:** `fii_details` com `fii_type`, `segment`, `net_worth`, `vacancy_rate` (tijolo) / `indexador` (papel).
- **Critérios de aceite:** FII de tijolo nunca tem `indexador` preenchido e vice-versa; validação a nível de aplicação.
- **Referências:** RF21, spec seção 3.6.
- **Dependências:** 3.1.

---

## Semana 4 — Eventos Macro

### 4.1 · Tabelas de eventos macro
- **Descrição:** `macro_events` e `macro_event_targets`.
- **Critérios de aceite:** um evento pode mirar setor, empresa específica, ou ativo específico.
- **Dependências:** 1.3.

### 4.2 · Regras de defasagem preço↔fundamentos
- **Descrição:** lógica que aplica efeito de evento primeiro no preço (expectativa) e só depois nos fundamentos (confirmação no próximo relatório, ligado à tarefa 3.6).
- **Critérios de aceite:** efeito de preço é imediato; efeito de fundamentos só aparece no próximo ciclo de relatório.
- **Referências:** RF16.
- **Dependências:** 3.6, 4.1.

### 4.3 · Seed do catálogo de templates
- **Descrição:** os 10 templates de evento pré-definidos (spec seção 3.3.2).
- **Critérios de aceite:** todos os 10 templates carregados e disparáveis.
- **Dependências:** 4.1.

### 4.4 · API de disparo (manual + template)
- **Descrição:** endpoint para criar evento avulso ou a partir de template.
- **Critérios de aceite:** validação de campos obrigatórios (magnitude, tipo de efeito, alvo).
- **Referências:** RF13.
- **Dependências:** 4.3.

### 4.5 · Endpoints do painel admin
- **Descrição:** backend para listagem/histórico de eventos disparados.
- **Critérios de aceite:** só acessível por `role = admin` (RNF07).
- **Referências:** RF14; telas 10.1–10.2 do inventário.
- **Dependências:** 4.4, 1.4.

---

## Semana 5 — Backend Gamificado

### 5.1 · XP/nível
- **Descrição:** acumulação de XP e derivação de nível.
- **Critérios de aceite:** XP creditado por ações definidas (lição concluída, missão cumprida, etc.), nível recalculado automaticamente.
- **Dependências:** 1.4.

### 5.2 · Conquistas
- **Descrição:** `achievements`/`user_achievements`, critérios de desbloqueio (ex: patrimônio, uso contínuo).
- **Critérios de aceite:** conquista desbloqueia automaticamente ao critério ser satisfeito, sem ação manual do usuário.
- **Referências:** RF09 (TCC); tela 7.2 do inventário.
- **Dependências:** 5.1.

### 5.3 · Streak diário
- **Descrição:** contador de dias consecutivos de uso.
- **Critérios de aceite:** streak reseta corretamente após 1 dia sem atividade qualificada; timezone tratado com cuidado.
- **Dependências:** 5.1.

### 5.4 · Missões diárias
- **Descrição:** `daily_missions`/`user_mission_progress`, catálogo simples renovado por dia.
- **Critérios de aceite:** conclusão de missão credita XP e conta para o streak (spec seção 6.1).
- **Referências:** RF22.
- **Dependências:** 5.1, 5.3.

### 5.5 · Ranking em janela fixa
- **Descrição:** cálculo de rentabilidade percentual por usuário numa janela (semana/mês), não cumulativa.
- **Critérios de aceite:** resultado consistente independente de quando o usuário entrou na plataforma.
- **Referências:** RF17.
- **Dependências:** 1.5.

### 5.6 · Trilha — `lessons`/`user_lesson_progress`
- **Descrição:** backend do currículo: estrutura das 33 lições, progresso por usuário, lógica de desbloqueio.
- **Critérios de aceite:** lição só fica disponível se pré-requisito satisfeito; progresso retomável no meio.
- **Referências:** RF11.
- **Dependências:** 1.4.

### 5.7 · Cache Redis (cotações/rankings)
- **Descrição:** camada de cache para leitura de alta frequência.
- **Critérios de aceite:** latência de leitura de cotação/ranking cai perceptivelmente em relação à leitura direta do Postgres.
- **Dependências:** 3.2, 5.5.

### 5.8 · Sistema de amizade
- **Descrição:** busca por `username`, solicitação, aceite/recusa.
- **Critérios de aceite:** amizade só se confirma com aceite bilateral; sem bloqueio nesta fase (spec seção 8.1).
- **Referências:** RF18.
- **Dependências:** 1.4.

### 5.9 · Ranking com escopo Global/Amigos
- **Descrição:** extensão do ranking (5.5) com filtro por amizades confirmadas.
- **Critérios de aceite:** escopo Amigos reflete só `friendships.status = accepted`, mesma janela fixa do escopo Global.
- **Referências:** RF19.
- **Dependências:** 5.5, 5.8.

---

## Semana 6 — Frontend

> ⚠️ **Observação:** 28 telas em uma única semana é um ritmo bem apertado, mesmo com Claude Code. Vale considerar, ao chegar aqui, se alguma tela de menor prioridade (ex: Painel Admin, Missões Diárias como tela própria) pode ficar pra Semana 7 sem comprometer a demonstração pra banca.

### 6.1 · Shell e navegação
- **Descrição:** estrutura de navegação primária, barra superior, roteamento (spec de telas seção 0).
- **Dependências:** 1.0 (identidade visual).

### 6.2 · Autenticação e Onboarding
- **Descrição:** telas 1.1–1.2 do inventário.
- **Dependências:** 6.1, 1.4.

### 6.3 · Portfólio
- **Descrição:** tela 2.1 — separação visual sandbox/mercado ao vivo, XP/streak, gráfico de distribuição.
- **Dependências:** 6.1, 1.5, 5.1, 5.3.

### 6.4 · Trilha — Mapa e Lição *(tela âncora)*
- **Descrição:** telas 3.1–3.2. Fazer mockup dessa tela antes de implementar — define o padrão visual de progressão (nós, bloqueio/desbloqueio) reaproveitado em outros lugares.
- **Dependências:** 6.1, 5.6.

### 6.5 · Mercado completo *(telas âncora: Detalhe de Ativo + Confirmação)*
- **Descrição:** telas 4.1–4.8. Fazer mockup do Detalhe de Ativo (4.5, com as três variações Ações/ETF/FII) e da Confirmação de Ordem (4.7) antes de implementar — é o fluxo mais complexo da aplicação.
- **Dependências:** 6.1, 3.2, 3.7, 3.8, 2.5.

### 6.6 · Feed de Notícias
- **Descrição:** tela 5.1.
- **Dependências:** 6.1, 4.2.

### 6.7 · Calculadora
- **Descrição:** telas 6.1–6.2 (modo simples e comparação).
- **Dependências:** 6.1.

### 6.8 · Classificação, Conquistas, Missões
- **Descrição:** telas 7.1–7.3.
- **Dependências:** 6.1, 5.2, 5.4, 5.9.

### 6.9 · Social — Amigos
- **Descrição:** telas 8.1–8.4.
- **Dependências:** 6.1, 5.8.

### 6.10 · Perfil e Configurações
- **Descrição:** telas 9.1–9.3 (a 9.3 agora restrita à LGPD, sem toggle de privacidade — spec v0.4).
- **Dependências:** 6.1, 1.4.

### 6.11 · Painel Admin
- **Descrição:** telas 10.1–10.2.
- **Dependências:** 6.1, 4.5.

---

## Semana 7 — Conteúdo e Integração

### 7.1 · Autoria das 33 lições
- **Descrição:** escrever o conteúdo pedagógico de cada lição (cenário, micro-decisão, revelação) — currículo já estruturado na spec seção 5.
- **Dependências:** 5.6.

### 7.2 · Seed de empresas/ativos/setores
- **Descrição:** popular o catálogo com empresas, ações, ETFs, FIIs e setores fixos (spec seção 3.3.2).
- **Dependências:** 3.5, 3.7, 3.8.

### 7.3 · Testes ponta a ponta
- **Descrição:** fluxos completos — compra/venda, resgate de renda fixa, evento macro → preço → relatório de resultado.
- **Dependências:** todas as anteriores.

---

## Semana 8 — Polimento

### 8.1 · Calibração fina dos parâmetros
- **Descrição:** ajuste de GBM/Vasicek/Selic neutra pra que a simulação "pareça" realista sem ser didaticamente confusa.
- **Dependências:** 7.3.

### 8.2 · Ajustes de UX
- **Descrição:** correção de atritos identificados nos testes ponta a ponta.
- **Dependências:** 7.3.

### 8.3 · Preparação da demonstração para a banca
- **Descrição:** roteiro de demo, dados de exemplo, conta de demonstração pré-populada.
- **Dependências:** 8.1, 8.2.

### 8.4 · Alinhamento com a monografia
- **Descrição:** garantir que o texto final do TCC reflita com precisão o que foi de fato implementado (evitar divergência entre spec e monografia).
- **Dependências:** todas as anteriores.

---

## Resumo de contagem

| Semana | Nº de tarefas |
|---|---|
| 1 — Fundação | 9 |
| 2 — Renda Fixa | 6 |
| 3 — Renda Variável e Fundamentos | 8 |
| 4 — Eventos Macro | 5 |
| 5 — Backend Gamificado | 9 |
| 6 — Frontend | 11 |
| 7 — Conteúdo e Integração | 3 |
| 8 — Polimento | 4 |
| **Total** | **55** |
