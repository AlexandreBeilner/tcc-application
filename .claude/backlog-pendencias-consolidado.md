# Backlog de pendências consolidado

Criado em 2026-09-27 a partir de uma auditoria geral de todos os documentos de `.claude/` (pedida
pelo autor: "acho que estamos na reta final... veja se deixei passar algo"). **Não é um backlog
novo de decisões** — cada item aqui já está aberto em algum outro documento; este arquivo só
centraliza tudo num lugar só, ordenado por prioridade sugerida, pra não precisar reabrir os 4
backlogs + o arquivo de achados toda sessão.

**Regra de manutenção:** a fonte da verdade de cada item continua sendo o documento original citado
em "Local". Ao concluir um item, marque ✅ **nos dois lugares** — aqui (pra este arquivo continuar
útil como visão geral) e no documento original (convenção já usada em todo o repo: ✅ no título +
bullet "Entregável"). Se um item aqui ficar com um novo achado/decisão durante a implementação,
registre o Entregável completo só no documento original (evita duplicar/divergir a mesma informação
em dois lugares) e só referencie aqui.

Nenhum item deste arquivo é urgente por si só (nada está quebrado em produção) — são lacunas de
escopo já identificadas, não bugs.

---

## Prioridade 1 — Fecha a Semana 7 e libera a Semana 8 (polimento pra banca)

Estas duas são as últimas peças fundacionais do backlog principal. Sem elas, a Semana 8 inteira
(calibração, UX, demo pra banca, alinhamento com a monografia) não pode começar.

### P1.1 · Seed de catálogo completo (empresas/ativos/setores) ✅ concluída (2026-09-27)

- **Local:** `.claude/backlog-plataforma-investimentos.md`, tarefa **7.2** (linha ~1025) — Entregável
  completo lá.
- **Resumo:** catálogo foi além do mínimo pedido — **35 ativos de renda variável** (25 ações/24
  empresas cobrindo os 6 setores fixos com distribuição de qualidade Boa/Média/Ruim via nova coluna
  `companies.base_growth_pct`, 5 ETFs com metodologia própria cada, 5 FIIs em 3 segmentos de tijolo +
  2 indexadores de papel). Achado registrado (não bloqueante): ROE/margem continuam fixos por setor
  (só o crescimento diferencia P/L e P/VP) — `pontos-em-aberto-decisao-produto.md`, achado 025.
- **Status:** ✅ Resolvido. Libera P1.2 (e2e formal).

### P1.2 · Testes ponta a ponta formais

- **Local:** `.claude/backlog-plataforma-investimentos.md`, tarefa **7.3** (linha ~1037)
- **O que falta:** hoje toda validação "ponta a ponta via `docker compose up`" é manual
  (curl/Chrome, a cada sessão) — não existe `backend/test/e2e/` nem `npm run test:e2e`. A tarefa
  original pede suíte `supertest` apontando pro gateway real (não `createApp()` em processo)
  cobrindo as 3 jornadas da spec: compra/venda de ação com gate de desbloqueio, resgate de renda
  fixa com IR, evento macro → preço → relatório.
- **Depende de:** P1.1 (precisa do catálogo completo pra ter tickers/setores reais pra testar).

### P1.3 · Semana 8 — Polimento (não pode começar antes de P1.2)

- **Local:** `.claude/backlog-plataforma-investimentos.md`, tarefas **8.1-8.4** (linha ~1048)
- **O que é:** 8.1 calibração fina dos parâmetros, 8.2 ajustes de UX (atritos achados nos e2e),
  8.3 preparação da demonstração pra banca (roteiro, dados de exemplo, conta pré-populada), 8.4
  alinhamento final entre spec/monografia e o que foi de fato implementado. Nenhuma tem descrição
  detalhada ainda no documento original — só a intenção; vale detalhar cada uma quando a sessão for
  aberta.
- **Depende de:** P1.2.

---

## Prioridade 2 — Fase T em andamento (branch não mesclada)

### P2.1 · Fase T — Salário mensal simulado (T.4 a T.11)

- **Local:** `.claude/backlog-motor-mercado-realista.md`, Fase T (linha ~4601)
- **Estado real:** branch local `fase-t-salario-mensal` (não pusheda pro `origin`, não mesclada em
  `main`) já tem **T.1, T.2, T.3 concluídas** (commits `633d279`, `b4c7658`, `7533446`). Faltam:
  - **T.4** · detecção do 5º dia útil do mês-calendário real
  - **T.5** · job de folha de pagamento com catch-up e idempotência (depende de T.2/T.3/T.4)
  - **T.6** · salário aparece no calendário do usuário
  - **T.7** · frontend: marcador de salário + teatro de recompensa
  - **T.8** · salário exposto na resposta de progressão
  - **T.9** · indicador persistente de salário no Dashboard
  - **T.10** · salário no teatro de recompensa do level-up
  - **T.11** · passo no onboarding explicando o salário
- **Ação antes de continuar:** decidir se retoma direto na branch `fase-t-salario-mensal` (`git
  checkout fase-t-salario-mensal`) — hoje o worktree está em `HEAD` destacado, num commit anterior
  a essa branch (`fffb030`).

---

## Prioridade 3 — Decisões de produto pendentes (acham sem correção mecânica)

Cada uma exige uma escolha do autor entre opções válidas, não é bug.

### P3.1 · `RiskProfile.MarketOrderPreference` nunca é lido

- **Local:** `.claude/pontos-em-aberto-decisao-produto.md`, achado **001**
- **Resumo:** campo validado/semeado/persistido, mas nenhum arquétipo de bot o consulta — todos
  geram sempre ordem limitada. Decidir: (a) confirmar adiamento deliberado pra Fase D (já concluída
  — precisaria reabrir com esse uso) e documentar isso no comentário do pacote `bot`, ou (b)
  desenhar agora a regra de uso.

### P3.2 · Duas fontes de sensibilidade à Selic divergentes pra mesma empresa

- **Local:** `.claude/pontos-em-aberto-decisao-produto.md`, achado **008**
- **Resumo:** crescimento de receita usa sensibilidade por setor (`CoefficientsBySector`),
  retorno exigido no preço justo usa sensibilidade por `risk_class` (`SensitivityByRiskClass`) — já
  divergem hoje pra VALR3/BNDD4. Decidir: (a) unificar as duas numa fonte por setor (maior blast
  radius — assinatura de 11 parâmetros, vários call sites e testes), ou (b) manter deliberadamente
  separadas e documentar como decisão consciente.

### P3.3 · Teto máximo de `SpreadWidthPct` pra bot Market Maker criado via admin (novo, ainda não registrado no arquivo de achados)

- **Local:** achado embutido em `.claude/backlog-motor-mercado-realista.md`, tarefa **N.1** (linha
  ~2748) — **ainda não tem entrada própria em `pontos-em-aberto-decisao-produto.md`, vale promover
  antes de abrir N.1.**
- **Resumo:** `bot.NewRiskProfile` só rejeita `SpreadWidthPct < 0` — sem teto superior, um valor
  `>= 2` faz `DecideMarketMakerOrders` colapsar o book. Hoje inofensivo porque só o seed cria bot
  (sempre com `0.02` fixo); `POST /admin/bots` (N.1) seria o primeiro consumidor real vindo de input
  externo, e precisa de um teto antes de aceitar esse campo.

---

## Prioridade 4 — Painel Admin de Bots (o próprio autor marcou como última prioridade)

### P4.1 · N.1 — Endpoints admin pra listar/criar/desativar bots

- **Local:** `.claude/backlog-motor-mercado-realista.md`, tarefa **N.1** (linha ~2730)
- **Bloqueio:** resolver P3.3 antes (teto de `SpreadWidthPct`) — o próprio texto da tarefa já pede
  isso.

### P4.2 · N.2 — Tela "Painel Admin — Bots" no frontend

- **Local:** `.claude/backlog-motor-mercado-realista.md`, tarefa **N.2** (linha ~2754)
- **Depende de:** P4.1.

---

## Prioridade 5 — Engajamento/gamificação (só um item realmente acionável agora)

### P5.1 · D.2 — XP variável por desempenho na Micro-decisão

- **Local:** `.claude/backlog-engajamento-gamificacao.md`, tarefa **D.2** (linha ~532)
- **Por que pode ser feita já:** independente de D.0/D.1 (não depende de dado de produção nem de
  blocos tipados) — só depende da Fase B (aposta com acerto/erro real), já concluída.
- **Resumo:** `LESSON_XP_REWARD` hoje é flat (50 XP); variar conforme desempenho na micro-decisão
  (acerto de primeira > acerto depois de errar > sem aposta real). Lição sem aposta real continua
  premiando os mesmos 50 XP (sem regressão).

### P5.2 · D.0 — Checkpoint de decisão (blocos tipados) — **não abrir ainda**

- **Local:** `.claude/backlog-engajamento-gamificacao.md`, tarefa **D.0** (linha ~501)
- **Por que está parado:** exige dias/semanas de uso real em produção pra responder com dado (não
  achismo) — a aplicação ainda não está em produção. Só revisitar quando isso mudar.

---

## Prioridade 6 — App mobile (trilha separada, escopo grande)

### P6.1 · Mesclar a Fase 1 já concluída

- **Local:** branch `mobile-1-1-bootstrap-react-native` (empurrada pro `origin`, não mesclada em
  `main`)
- **Estado real:** as 4 tarefas da Fase 1 (`.claude/backlog-app-mobile.md`, linha ~36) —
  bootstrap do projeto, WebView real, navegação nativa, tela de erro/sem conexão — já estão
  concluídas nessa branch. Existe uma segunda branch mais antiga e menos avançada
  (`mobile-1-2-webview-real`, só 1.1-1.2) que parece ter sido superada — conferir antes de mesclar
  qual das duas é a versão certa a levar pra `main`.

### P6.2 · Fase 2 — Sessão e recursos que o SPA já tem mas o WebView não dá de graça

- **Local:** `.claude/backlog-app-mobile.md`, tarefas **2.1-2.3** (linha ~147)
- **Resumo:** ponte de sessão segura (Keychain/Keystore), upload de avatar dentro do WebView, ponte
  de download (exportação de dados LGPD).
- **Depende de:** P6.1 mesclada.

### P6.3 · Fase 3 — Login Google nativo (única fase que toca `backend/`)

- **Local:** `.claude/backlog-app-mobile.md`, tarefas **3.1-3.3** (linha ~231)
- **Resumo:** identificadores técnicos + Google Cloud Console, endpoint novo de troca de idToken
  por JWT (já vem com desenho concreto no documento), SDK nativo de login Google ponta a ponta.

### P6.4 · Fase 4 — Identidade, publicação e iOS (deixada por último de propósito)

- **Local:** `.claude/backlog-app-mobile.md`, tarefas **4.1-4.4** (linha ~329)
- **Resumo:** identidade visual final do app, política de privacidade pública, publicação Google
  Play, validação e publicação iOS (precisa de CI macOS em nuvem — Xcode não roda em Linux).

---

## Housekeeping (não é backlog de produto, mas vale resolver de passagem)

### H.1 · `main` local desatualizada em relação a `origin/main`

A branch `main` local está ~7 PRs atrás de `origin/main` (parada em torno do PR #39, enquanto
`origin/main` já está no PR #45 — Fase S). Rodar `git fetch && git checkout main && git pull` antes
de abrir qualquer branch nova a partir dela.

### H.2 · Branches locais órfãs, candidatas a limpeza

`semana-5-backend-gamificado` e `semana-6-trilha` não estão mescladas em `origin/main`, mas o
trabalho que elas continham parece coberto por outro caminho já mesclado (a Semana 5/6 do backlog
principal está toda ✅). Conferir com `git log <branch> --not origin/main` antes de decidir apagar —
não apagar sem essa checagem.

---

## Sequência sugerida

1. **P1.1 → P1.2** (catálogo completo → e2e formal) — fecha a Semana 7.
2. **P2.1** (T.4 → T.5 → T.6 → ... → T.11, retomando `fase-t-salario-mensal`) — pode rodar em
   paralelo ao passo 1, é uma trilha independente do motor.
3. **P3.3 → P4.1 → P4.2** (teto de spread, depois o Painel Admin de Bots em si).
4. **P3.1, P3.2** — decisões pontuais, encaixar em qualquer sessão livre.
5. **P5.1** — sessão isolada e pequena, sem dependência de nada acima.
6. **P1.3** (Semana 8, polimento) — só depois do passo 1 fechado.
7. **P6.1 → P6.2 → P6.3 → P6.4** — trilha mobile, independente de tudo acima; entra quando houver
   sessão dedicada a ela.
8. **H.1, H.2** — a qualquer momento, leva minutos.

`P5.2` (D.0) fica fora da sequência — só entra quando houver uso real em produção pra avaliar.
