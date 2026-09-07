# CLAUDE.md

Este arquivo orienta qualquer sessão do Claude Code neste repositório. Leia-o antes de iniciar qualquer tarefa.

## Visão geral do projeto

Protótipo de plataforma web gamificada para educação financeira (TCC — Alexandre Beilner, UNO, 2026). Simula investimentos em Renda Fixa e Renda Variável com dados sintéticos, ensinando por meio de uma trilha de lições e reforçando engajamento com XP, conquistas, streak, missões diárias e um sistema social (ranking entre amigos).

## Documentação de referência

Toda decisão de produto e arquitetura já está fechada nestes três documentos, em `.claude/`. **Não redecida algo que já está documentado ali — leia antes de assumir.**

| Arquivo | O que contém |
|---|---|
| `.claude/especificacao-plataforma-investimentos.md` | Fonte da verdade: arquitetura, modelo de dados (DER), motor de mercado, currículo de 33 lições, requisitos formais (RF/RNF), corte de MVP, roadmap de 8 semanas, changelog de decisões (v0.1–v0.5) |
| `.claude/inventario-telas-plataforma-investimentos.md` | As 28 telas da aplicação — objetivo, conteúdo, ações e navegação de cada uma |
| `.claude/backlog-plataforma-investimentos.md` | Quebra de tarefas executáveis, organizada pelas 8 semanas do roadmap, com critérios de aceite e dependências |
| `.claude/identidade-visual-tokens.md` | Tokens de design (tarefa 1.0): paleta dark/light, tipografia, espaçamento, raio/elevação — toda estilização de componente/tela deve seguir este documento |
| `.claude/identidade-visual-padroes.md` | Padrões de composição (complementa os tokens): linguagem visual "home broker + gamificação" (sparklines, price-flash, convenção sólido/tracejado, teatro de recompensa), regra de linha de progressão com altos e baixos, e composição responsiva própria por breakpoint (mobile/tablet/desktop) — mockup vivo das telas-âncora linkado no documento |
| `.claude/arquitetura-backend-ddd-lite.md` | Arquitetura obrigatória do `backend/` (DDD lite): estrutura de módulos (domain/application/infrastructure/interfaces), regra de dependência, casos de uso, validação com Zod, testes sempre junto da implementação, SOLID aplicado. `modules/auth` é a referência viva — leia o código antes do documento. |
| `.claude/arquitetura-engine-go.md` | Arquitetura obrigatória do `engine/` (Go idiomático — não é o mesmo padrão do backend Node): domínio isolado de infraestrutura, interfaces pequenas declaradas no ponto de consumo, pacote por conceito de domínio, fórmulas financeiras como funções puras testáveis. |
| `.claude/diretrizes-redacao-eventos-macro.md` | Guia de redação pra expandir o catálogo estático de templates de evento macro (`engine/internal/domain/macroevent/templates.go`, tarefa 6.6.3): regra de não entregar o veredito no título/narrativa, arquétipos de narrativa pra variar o formato, e checklist antes de adicionar um template novo. |
| `.claude/proposta-engajamento-licoes.md` | **Proposta, não decisão fechada** (única exceção da tabela acima): estudo de gamificação/engajamento das lições pedido pelo autor depois da 7.1 — diagnóstico do texto em bloco, técnicas de fatiamento, mapeamento dos 8 Core Drives do Octalysis (spec seção 6) pouco explorados dentro da lição. Já convertido em tarefas executáveis em `backlog-engajamento-gamificacao.md`; mantido como o "porquê" por trás delas. |
| `.claude/backlog-engajamento-gamificacao.md` | Backlog executável (autor confirmou avançar) derivado do documento acima: 30 tarefas em 10 fases (A-J) cobrindo lições (fatiamento, aposta com acerto/erro), o restante da gamificação (Perfil, feed social, missões, conquistas por qualidade, teatro de recompensa em tempo real) e o tratamento de conteúdo travado pela trilha (Fase J, maior prioridade da sequência sugerida). Auditado contra o código real (4 suposições erradas corrigidas) e com sequência de implementação sugerida no final. Segue a mesma disciplina de sessão-por-tarefa do backlog principal. |
| `.claude/estrategia-monetizacao.md` | **Proposta, não decisão fechada** (mesma exceção do documento de engajamento acima): modelo de monetização freemium discutido depois que o autor considerou publicar o app pra usuários reais. Descarta explicitamente um sistema de energia/vidas com paywall (conflita com o limite ético já fixado em `proposta-engajamento-licoes.md` — nunca escassez artificial, só convite); camada paga proposta é pacote de trilhas extras, múltiplas carteiras, certificado exportável, cenários extras de simulação e cosméticos, mais uma mecânica colaborativa ("Assembleia dos Investidores" — votação de pagantes decide evento macro real tipo Selic/taxação setorial, com guarda-corpo anti-pay-to-win: apuração pública, resultado igual pra todos, um voto por conta). Nunca bloqueia o core loop (lições, XP/streak, compra/venda). Sem tarefa de backlog aberta — fica só documentado por ora. |

Ao pegar uma tarefa, sempre confira a numeração (ex: RF17, tela 4.5, tarefa 5.4) contra esses documentos — as referências cruzadas são intencionais e existem pra evitar retrabalho.

## Documentação de endpoints (`.docs/`)

Diferente de `.claude/` (decisão de produto/arquitetura fechada), `.docs/` documenta o contrato HTTP atual — payload, resposta de sucesso, erros possíveis e regra de negócio resumida de cada endpoint. `.docs/backend/` (um arquivo por módulo, ex: `auth.md`) e `.docs/engine/` (idem, ainda quase vazio). Template e regra de atualização em `.docs/README.md`. **Toda rota nova ou alterada é documentada no mesmo commit/sessão que a cria** — não é um passo à parte.

## Arquitetura — resumo rápido

| Serviço | Stack | Container? |
|---|---|---|
| Motor de Simulação | Go | **Sim**, sempre |
| Backend Gamificado | Node.js + TypeScript | **Sim**, sempre |
| Frontend | React + TypeScript | **Não** — roda local (dev server / build estático fora do Compose) |
| Postgres (2 bancos lógicos: usuário/gamificação e mercado) | — | Sim |
| Redis (cache de cotações e rankings) | — | Sim |

Comunicação entre serviços: HTTP/JSON, via proxy reverso (gateway) como porta de entrada única do backend. Ver diagrama completo na spec, seção 3.

## Regras críticas — não esquecer

Estas são decisões já fechadas que geram retrabalho se ignoradas:

- **Container é obrigatório para todo o backend** (motor, backend gamificado, Postgres, Redis). O frontend é a única exceção — nunca criar Dockerfile pra ele.
- **Event Sourcing é a fonte da verdade financeira**: nenhuma escrita de saldo/posição acontece sem antes gravar um evento imutável em `market_events`. Não escrever direto em `positions`/`accounts` sem passar por esse fluxo.
- **Capital inicial é sempre R$ 10.000,00** por conta nova, no mercado ao vivo (RNF06) — não deixar configurável.
- **Não há perfil privado nesta fase.** Todo usuário é público por decisão explícita (spec v0.4/8.2). Não implementar toggle de visibilidade de perfil — isso é candidato de Fase 2, fora de escopo agora.
- **Valor absoluto de patrimônio nunca é exposto a outro usuário** — nem no ranking, nem no perfil público, nem na busca de amigos. Só rentabilidade percentual, nível e conquistas (RNF09). Essa regra não é configurável, é garantia do sistema.
- **Amizade é bilateral com aceite**, não é "seguir" unilateral. Sem bloqueio de usuário nesta fase (deferido pra Fase 2).
- **Indicadores de ativo variam por classe** (RF21, spec 3.6): Ações mostram fundamentalistas tradicionais (P/L, P/VP, ROE etc.); ETFs mostram índice de referência + metodologia + composição sintética, **não** indicadores de empresa; FIIs se dividem em tijolo (segmento, patrimônio, vacância) e papel (indexador), ambos com Dividend Yield. Não reaproveitar o layout de indicadores de Ações pra ETF/FII.
- **`role = admin` nunca é atribuível por autocadastro** — só via seed manual.
- **Ranking usa janela fixa** (semana/mês), não é cumulativo desde a criação da conta (RF17), e tem dois escopos independentes — Global e Amigos — que compartilham a mesma janela.

## Como trabalhar a partir do backlog

1. Siga `.claude/backlog-plataforma-investimentos.md` na ordem das semanas. Dentro de uma semana, respeite as dependências listadas em cada tarefa antes de começá-la.
2. Cada tarefa do backlog é pensada como escopo razoável de uma sessão — não tente empacotar várias tarefas numa sessão só, isso dificulta revisão e rollback.
3. Ao concluir uma tarefa, verifique os critérios de aceite listados nela antes de considerar pronta.
4. Tarefas marcadas como "tela âncora" no backlog (Mapa da Trilha, Detalhe de Ativo + Confirmação de Ordem) merecem um mockup/rascunho de layout antes da implementação — elas definem um padrão visual reaproveitado em outras telas, fixado em `.claude/identidade-visual-padroes.md`.
5. Se uma tarefa exigir uma decisão de produto que não está em nenhum dos três documentos, pare e pergunte — não assuma. Documente a decisão tomada de volta nos arquivos correspondentes depois.

## Checklist obrigatório — toda tarefa que toca o backend (Node) ou o motor (Go)

### `backend/` (Node/TS, DDD lite — detalhe completo em `.claude/arquitetura-backend-ddd-lite.md`)

- [ ] Regra de negócio nova vive em `modules/<módulo>/domain/` ou `application/useCases/` — nunca dentro de um router (`interfaces/http/`) ou de um adapter (`infrastructure/`).
- [ ] Todo acesso a banco, hash, token ou serviço externo passa por uma `port` (interface em `application/ports/`), implementada em `infrastructure/` — nunca chamado direto de `domain/`/`application/`.
- [ ] A única peça de código que instancia infraestrutura concreta (`new DrizzleXRepository`, `createBcryptPasswordHasher`, etc.) é a composição — `app.ts`/`server.ts`/script de seed.
- [ ] Rota HTTP nova valida a entrada com Zod antes de chamar o caso de uso.
- [ ] Caso de uso, adapter e router novos têm teste no mesmo commit/sessão (não depois) — caso de uso com fakes de `test/fakes/`, adapter testando a implementação real, router via supertest.
- [ ] `npm run lint` (as regras de `no-restricted-imports` em `eslint.config.mjs` bloqueiam mecanicamente `domain/`/`application/` importando infraestrutura — se o lint falhar por isso, é sinal de camada errada, não suprimir a regra), `npm run build` e `npm test` passam.
- [ ] Rota HTTP nova ou alterada está documentada em `.docs/backend/<módulo>.md` (payload, sucesso, erros, regra — template em `.docs/README.md`).
- [ ] Validação de ponta a ponta via `docker compose up` antes de marcar a tarefa como concluída no backlog.

### `engine/` (Go idiomático — detalhe completo em `.claude/arquitetura-engine-go.md`, **não** é o mesmo padrão do backend Node)

- [ ] Fórmula/regra de negócio nova é função pura em `internal/domain/` (ou subpacote de domínio) — sem `net/http`, `database/sql`, nem import de `internal/infra`.
- [ ] Se o domínio precisa de um colaborador externo (persistência, feed de dados), a interface é pequena (1–3 métodos) e declarada dentro do próprio `internal/domain/`, nunca numa pasta `ports/` central — o adapter concreto fica em `internal/infra/`.
- [ ] A única peça de código que instancia adapter concreto é `cmd/api/main.go`.
- [ ] Toda fórmula financeira tem teste (idealmente table-driven) no mesmo commit/sessão — exigência já valia desde a 1.1a (TCC cap. 7.2.4).
- [ ] `golangci-lint run` passa (a regra `depguard` em `.golangci.yml` bloqueia mecanicamente `internal/domain/` importando infraestrutura — se falhar por isso, é sinal de camada errada, não suprimir a regra), `go build` e `go test ./...` passam.
- [ ] Rota HTTP nova ou alterada está documentada em `.docs/engine/<pacote>.md` (payload, sucesso, erros, regra — template em `.docs/README.md`).
- [ ] Validação de ponta a ponta via `docker compose up` antes de marcar a tarefa como concluída no backlog.

## Convenções de código

- **Go (motor de simulação):** `golangci-lint`, domínio separado de infraestrutura, testes unitários obrigatórios para toda fórmula financeira (cap. 7.2.4 do TCC). Padrão de arquitetura em `.claude/arquitetura-engine-go.md` — Go idiomático (interfaces pequenas no ponto de consumo, pacote por conceito de domínio), não o DDD lite do backend Node.
- **Node.js/TypeScript (backend gamificado):** ESLint + Prettier. Arquitetura DDD lite obrigatória (ver `.claude/arquitetura-backend-ddd-lite.md`) — domínio separado de infraestrutura, casos de uso injetados com ports (inversão de dependência), validação de entrada com Zod na borda HTTP, teste sempre criado junto com a implementação (não depois), sem god classes/métodos gigantes.
- **React/TypeScript (frontend):** Vite, componentes seguindo os tokens de identidade visual (tarefa 1.0 do backlog) antes de estilizar qualquer tela. Estrutura de pastas por camada: `components/` segue **atomic design** (decisão da tarefa 6.3.4, revertendo o adiamento "esperar um segundo consumidor" da 6.3.1) e concentra **todo** componente visual do app, não só o compartilhado — `atoms/` (`Button`, `Card`), `molecules/` (`NewsBell`), `organisms/` (`TopBar`, `TabBar`, `AvatarMenu`, `NetWorthCards`, `ProgressionSummary`, `DistributionChart`, `ResumeLessonCard`), `templates/` (`AppShell` — composição de shell/rota sem conteúdo próprio, no sentido literal de Brad Frost; a pasta `layouts/` que existia até a 6.3.3 foi **aposentada**, o conceito "template" a substitui). `features/<domínio>/` guarda só lógica/estado/hook sem UI decomposta em átomo/molécula/organismo (ex: `features/auth/AuthContext`+`ProtectedRoute` — guarda de rota e estado, sem markup próprio; `features/portfolio/`+`features/shell/` com hooks de query e funções puras). `pages/` (componente de rota — destino final de URL, não reaproveitável, por isso não entra em `components/` mesmo sendo pasta-por-módulo) continua separada no topo. `routes/`, `services/` (cliente HTTP, 1:1 com `.docs/backend/`), `store/` (reservada — só ganha uma lib de estado global quando houver caso de uso real; Context + TanStack Query cobrem hoje), `utils/` (função pura cross-feature). **Todo módulo de `components/`/`features/*`/`pages/`/`services/` é uma pasta** (decisão da tarefa 6.3.4): `index.ts(x)` é a única porta de entrada de fora (import por caminho de pasta nunca muda de string, resolução padrão do TS/Vite), `types.ts` só quando o módulo declara interface/type local (mesmo não-exportada — uma `class` como `ApiError` fica no `index.ts`, não é tipo), `index.module.css` se tiver CSS próprio, `index.test.ts(x)` co-localizado (sufixo extra preservado quando já existia, ex: `index.integration.test.tsx`). Nomenclatura: componentes em PascalCase (arquivo e export), hooks/funções/variáveis em camelCase. Lint com oxlint (não ESLint — decisão da 6.3.2, evitar redundância); Prettier com `tabWidth: 4`, `singleQuote: true`, `printWidth: 140`. **Toda tela nova precisa nascer responsiva nos três breakpoints — desktop, tablet e smartphone** (decisão da tarefa 6.3.3, revertendo o adiamento da 6.1) — breakpoints mobile `< 768px` / tablet `768–1023px` / desktop `≥ 1024px`; navegação primária (`TabBar`) é barra inferior fixa em mobile, barra horizontal abaixo da `TopBar` em tablet/desktop — nunca uma tab bar fixa no topo em mobile. **Desktop não é mobile esticado**: a partir de 1024px a tela ganha composição própria (ex: layout 2 colunas com painel lateral fixo), nunca só a coluna única centralizada com espaço morto nas laterais — padrões de composição por breakpoint (incluindo motivos visuais "home broker + gamificação" e a regra de linha de progressão com altos e baixos) em `.claude/identidade-visual-padroes.md`.
