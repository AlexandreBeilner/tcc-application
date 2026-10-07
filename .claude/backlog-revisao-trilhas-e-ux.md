# Backlog: Revisão das trilhas e melhorias de UX

Criado em 2026-10-03 a partir de uma rodada de testes do autor no app (18 pedidos, listados na seção
"Rastreabilidade") e de uma análise com 9 agentes de leitura, uma por área. Os relatórios completos, com
arquivo:linha, fontes web e propostas detalhadas de widget e pergunta, estão em
`.claude/revisao-trilhas-anexos/` e são o "porquê" por trás de cada tarefa abaixo. Este arquivo é só o plano
executável.

| Anexo | Cobre |
|---|---|
| `audit-licoes-0-3.md` | lições 0.1-0.5 e 3.1-3.4 |
| `audit-licoes-1a.md` | lições 1.1-1.6 |
| `audit-licoes-1b.md` | lições 1.7-1.11 |
| `audit-licoes-2a.md` | lições 2.1-2.5 e 2.6.1-2.6.6 |
| `audit-licoes-2b.md` | lições 2.7-2.10 |
| `varredura-tcc-dados.md` | referências proibidas e dados irreais no repositório inteiro |
| `analise-player-licao.md` | player: revisão, voltar, aposta, widgets, card de bloqueio |
| `analise-calendario.md` | escalonamento de proventos e calendário "o que me afeta" |
| `analise-mapa-portfolio-sandbox.md` | mapa da trilha, donut, cards Sandbox |

## Objetivo (vale mais que qualquer tarefa individual)

Melhorar as lições: **mais engajamento, mais elementos visuais, e conteúdo que representa e ensina como as coisas
funcionam no Brasil.** Aprender tem que ser **leve**. A revisão acrescenta profundidade e correção, mas **nunca
em forma de textão**: a profundidade vem de visual, widget interativo, exemplo com número e pergunta curta, não de
parágrafo. Se uma lição ficou mais correta e mais pesada de ler, ela falhou.

## Princípios (valem para todas as tarefas)

0. **Leveza.** Cartão de texto curto (alvo: até ~280 caracteres, teto duro verificado por teste), uma ideia por
   cartão, no máximo um conceito novo por vez; antes de escrever um segundo parágrafo, trocar por visual, tabela,
   exemplo com números ou widget; pergunta curta a cada 2 ou 3 cartões. Texto longo só como "saiba mais"
   recolhido, nunca no caminho principal. Cada lição deve poder ser concluída em poucos minutos.

1. **A lição ensina o Brasil real.** Texto de lição descreve como a coisa funciona no mundo real. Quando a
   plataforma difere do real, a diferença aparece num bloco padronizado **"Na plataforma"** com três linhas:
   *No Brasil*, *Aqui*, *Por quê*. Nunca texto do tipo "na reunião X isso acontece" como se fosse o conteúdo.
2. **Nada de dev vaza para o usuário.** Proibido em qualquer texto visível: TCC, spec, cap. N, backlog, motor,
   feed, painel (no sentido interno), nome de coluna, número de lição/tarefa, ticker de teste. Garantido por teste
   automatizado (RC.1.1), não por disciplina.
3. **Nenhum termo antes da apresentação.** Todo termo técnico usado numa lição foi definido numa lição anterior
   (ou tem definição inline + glossário). Garantido por lint de pré-requisitos (RC.1.2).
4. **Nunca pedir conta fora da plataforma.** Toda conta que a lição pede é feita por um widget interativo.
5. **Errar não avança.** Pergunta intermediária só libera quando acertada, tentativas ilimitadas; a cada erro a alternativa errada é desativada (sem dicas); o gabarito só aparece ao acertar.
6. **Fato regulatório com fonte e data.** Número de lei, alíquota, teto ou prazo vive num módulo versionado
   (RC.1.3), com `verifiedAt` e link. Fatos marcados *[reconferir]* nos anexos só entram no texto depois de
   verificados em fonte primária (Banco Central, Receita, B3, CVM, FGC, Tesouro Direto).
7. **Seed idempotente sem desfazer edição do admin** (tarefa N.23 do backlog do motor). Só colunas aditivas;
   conteúdo novo entra por patch de dados versionado.
8. **Checklist do CLAUDE.md** da camada tocada, testes no mesmo commit, `.docs/` atualizado, validação em
   `docker compose up`, um commit por tarefa. Telas novas nascem responsivas nos 3 breakpoints. Sem travessão
   como pontuação em texto de UI.
9. **Mudança de padrão visual pede rascunho antes** (card de bloqueio, player desktop, calendário).

## Decisões de produto (todas decididas em 2026-10-03; D9 e D10 geram registros em em `pontos-em-aberto-decisao-produto.md` se o autor não decidir)

| # | Decisão | Recomendação dos agentes | Bloqueia |
|---|---|---|---|
| D1 | XP por acerto de primeira: manter 50 fixo ou bonificar? | **DECIDIDO (2026-10-03): manter 50 fixo por enquanto**; só registrar "de primeira" para conquistas. Bônus reavaliado depois | RC.2.3 |
| D2 | Revisão de lição registra a missão H.2 ao chegar na Revelação (em vez de ao abrir)? | **DECIDIDO (2026-10-03): ao chegar na Revelação** | RC.2.1 |
| D3 | Gabarito só ao acertar, ou "desistir e ver" após N erros? | **DECIDIDO (2026-10-03): gabarito só ao acertar; a cada erro a alternativa errada é desativada (some das opções), sem demais dicas.** Tentativas ilimitadas (acabam sobrando só a certa) | RC.2.3 |
| D4 | Dicas por alternativa errada: obrigatórias ou opcionais? | **DECIDIDO (2026-10-03): sem dicas por alternativa.** O único feedback a cada erro é desativar a opção errada; a explicação aparece depois do acerto | RC.2.3 |
| D5 | Card Sandbox: remover (A), rebaixar a faixa compacta (B), seletor único (C) ou mover ao Extrato (D)? Spec 3.1 e inventário 2.1 exigem hoje card separado "Modo Aprendizado". | **DECIDIDO (2026-10-03): opção B**, rebaixar a faixa compacta, não remover | RC.7.4 |
| D6 | Donut do Portfólio a custo ou a preço de mercado? | **DECIDIDO (2026-10-03): preço de mercado**, igual aos cards | RC.7.2 |
| D7 | Sandbox sem posição: some do Portfólio ou mantém dica de descoberta? | **DECIDIDO (2026-10-03): dica discreta** (uma linha, sem card grande nem R$ 0,00) | RC.7.4 |
| D8 | Calendário escalonado completo (Trilha A) ou alternativa barata (manter calendário e explicar em "Na plataforma")? | **DECIDIDO (2026-10-03): escalonar no motor (opção 1).** Trilha A entra no escopo; a Trilha B (UX) entrega valor antes e é independente | RC.6.* |
| D9 | JCP e IR sobre dividendos (Lei 15.270/2025) entram no motor ou só na lição? | **DECIDIDO (2026-10-03): só nas lições**; motor não muda agora, JCP e imposto de dividendos viram ponto em aberto em `pontos-em-aberto-decisao-produto.md` | RC.6.5, RC.5.* |
| D10 | Instante do snapshot de elegíveis a provento (data com vs data ex) | **DECIDIDO (2026-10-03): data com real, snapshot dos elegíveis na data ex**, explicado em bloco "Na plataforma" | RC.6.4 |
| D11 | Adicionar 2 lições novas (Juros/Selic/CDI/TR; B3/corretora/ordens) muda a contagem de 35 | **DECIDIDO (2026-10-03): sim**, com a progressão com dispensa (N.24); currículo ampliado para 43 lições | RC.4.1, RC.4.2 |
| D13 | Onde ficam as lições novas de vida real (orçamento, dívida): numa **Trilha F "Finanças do dia a dia"** paralela, sem desbloqueio de ativo e aberta em qualquer ordem (recomendação do mapa; pensada para crescer com golpes e FGTS depois), ou no começo da Trilha 0 (que passaria de 5 para 8 lições)? Reserva (RC.4.6) fica na Trilha 1 após a 1.2 nos dois casos | **DECIDIDO (2026-10-03): Trilha F paralela** para orçamento e dívida | RC.4.4, RC.4.5 |
| D12 | Substituir a trilha 3 atual (regras da plataforma, tickers fictícios) por conteúdo de planejamento real | **DECIDIDO (2026-10-03): reescrever.** Mantendo a prática no simulador como etapa separada | RC.5.8 |

---

## Fase 1: Higiene e prevenção (primeiro; barata e desbloqueia o resto)

### RC.1.1 · Teste de conteúdo proibido nos seeds e strings de UI ✅ concluída (2026-10-04)

- **Escopo:** teste vitest sobre `seedLessons`, `seedAchievements`, `seedMissions` e `centralConcept`/revelações, com
  regex para: `TCC`, `spec`, `cap\.\s*\d`, `backlog`, `motor`, `nesta plataforma` (permitido só dentro do bloco
  estruturado "Na plataforma"), `simulad` (idem), `—` como pontuação, `snake_case`, `lição \d`, `sandbox` em
  texto de aprendizado; **limite de tamanho por cartão** (teto duro, alvo ~280 caracteres, exceções só em bloco
  "saiba mais" recolhido) e proporção mínima de blocos visuais/interativos por lição. Equivalente em Go para `macroevent/templates.go`, `cmd/seed/main.go` (metodologia dos ETFs,
  nomes de ativo) e mensagens de erro de domínio. Teste/regra no frontend para strings JSX.
- **Aceite:** falha com a string e o arquivo:linha; passa no estado limpo; entra no `npm test`/`go test`.
- **Depende de:** nada. **Faz antes de RC.1.4** para a limpeza ser guiada pelo teste (red, depois green).
- **Entregável (2026-10-04):** três varreduras com as mesmas 12 regras (tcc, spec, capitulo, backlog, motor,
  nesta-plataforma, simulado, travessao, snake-case, numero-de-licao, sandbox, jargao-tecnico).
  Backend: `backend/src/content/contentRules.ts` + `visibleContent.test.ts` varrem `LESSON_SEEDS`,
  `ACHIEVEMENT_SEEDS`, `MISSION_SEEDS` (agora exportados; os dois seeds ganharam o guard `VITEST` do de lições) e o
  teto duro de 420 caracteres por cartão (alvo 280). Engine: `engine/internal/contentcheck` varre
  `macroevent.Templates`, literais de `cmd/seed/main.go` (por AST) e `errors.New`/`fmt.Errorf` dos domínios
  orderexecution, fixedincomeexecution, position e account. Frontend: `frontend/src/content/visibleContent.test.ts`
  (compilador TS: JSX, atributos e literais de prosa, fora de admin/testes, mais chaves `tcc.*`).
  **Decisão de execução:** como o estado atual tem violações conhecidas e o teste precisa passar, cada camada tem um
  **baseline em catraca** (`contentViolationsBaseline.json` no backend e no frontend; mapa `knownViolations` no Go):
  violação nova falha, violação resolvida também falha até o baseline encolher. **A RC.1.4 zera os baselines.**
  **Fica para depois (não existe ainda):** proporção mínima de blocos visuais por lição e exceção do bloco "Na
  plataforma" (dependem do contrato `blocks` da RC.3.1/RC.3.3); varredura de mensagens HTTP do engine (RC.1.5).
  Validou: `npm test`/`lint`/`build` do backend, `npm test`/`lint`/`tsc -b` do frontend, `go test ./...` e
  `golangci-lint` do engine.

### RC.1.2 · Lint de pré-requisitos de termos ✅ concluída (2026-10-04, em modo aviso)

- **Escopo:** tabela `termo -> lição que o define` (glossário estruturado, ver RC.3.5) e teste que falha se uma
  lição usa um termo cuja lição de definição vem depois na ordem da trilha e que não tem definição inline.
  Termos iniciais: Selic, CDI, TR, IPCA, ticker, ON/PN, valor de face, VNA, alavancagem, payout, JCP, ITR/DFP,
  valor de mercado, NAV, ágio/deságio, ordem a mercado/limite, spread, liquidez, cíclico/defensivo.
- **Aceite:** o teste acusa hoje os casos conhecidos (Selic na 0.5, CDI na 0.5, IPCA na 0.4/1.3, ticker na 2.2,
  ON/PN na 2.3) e fica verde quando a Fase 4 termina.
- **Depende de:** RC.3.5 (estrutura do glossário) pode ser feita em paralelo; o lint começa em modo aviso.
- **Entregável (2026-10-04):** `backend/src/modules/lessons/domain/termPrerequisites.ts` (+ teste): tabela de 19 termos
  (`id`, padrão, lição que define, `plannedIn`, chaves de glossário que contam como definição inline `{{termo}}`) e
  `findTermViolations`, que compara a ordem global de `sortOrder`. Termo cuja lição definidora ainda não existe
  (Selic, CDI, TR, IPCA: RC.4.1; ticker, ON/PN: RC.4.2) tem `definedIn: null` e acusa todo uso sem definição inline,
  por isso o lint só fica limpo quando a Fase 4 termina. `src/content/termPrerequisites.test.ts` roda sobre
  `LESSON_SEEDS`, exige os casos conhecidos (Selic e CDI na 0.5, IPCA na 0.4 e 1.3, ticker e ON/PN na 2.3) e imprime
  o relatório com `console.warn`; a constante `STRICT` vira `true` quando a Fase 4 fechar. Os códigos de
  `definedIn` dos termos que hoje nenhuma lição usa (payout, JCP, ITR/DFP, spread, liquidez etc.) são palpite
  inicial: confirmar na Fase 5 ao escrever a lição que define cada um. A tabela vive no backend; quando a RC.3.5
  criar o glossário estruturado, `glossaryKeys` passa a vir dele. Validou: `npm test`, `lint` e `build` do backend.

### RC.1.3 · Módulo de fatos regulatórios versionado ✅ concluída com ressalva (2026-10-04)

- **Escopo:** `backend/src/modules/lessons/domain/regulatoryFacts.ts` (e espelho consumido pelo frontend via
  conteúdo do seed): FGC (R$ 250 mil por CPF por conglomerado, teto global R$ 1 milhão em 4 anos), tabela
  regressiva de IR, IOF 30 dias, custódia B3 do Tesouro, poupança (duas regras + TR), isenção LCI/LCA/CRI/CRA
  e carência, Copom (8 reuniões/ano), meta de inflação (3% ±1,5 p.p.), Lei 15.270/2025 (dividendos), JCP,
  isenção de FII, IR de ETF. Cada fato: `valor`, `fonte` (URL), `verifiedAt`.
- **Fontes aceitas:** só primárias e oficiais (Banco Central/Copom/SGS, Receita Federal e legislação no Planalto,
  Tesouro Direto/Tesouro Nacional, B3, CVM, FGC, IBGE, Anbima). Notícia ou blog serve para achar a fonte, nunca
  é a fonte registrada.
- **Aceite:** todo número regulatório citado em lição vem de um fato; teste falha se `verifiedAt` tem mais de
  12 meses; todos os itens *[reconferir]* dos anexos resolvidos aqui com fonte primária antes da Fase 5.
- **Depende de:** nada. Itens a reconferir: IOF regressivo, custódia B3 0,20%, carência exata de LCI/LCA,
  Selic/IPCA/VNA atuais, pesos e abrangência do IPCA, regra do VNA em deflação, retenção de dividendos 2026,
  JCP 15%, isenção e requisitos de FII, resoluções CVM citadas, circuit breaker.
- **Entregável (2026-10-04):** `backend/src/modules/lessons/domain/regulatoryFacts.ts` (+ teste) com 16 fatos:
  FGC (limite por CPF, teto global, produtos), IR regressivo, IOF de 30 dias, custódia B3 do Tesouro, poupança,
  isenção LCI/LCA/CRI/CRA, prazo mínimo de LCI (12 meses) e LCA (9 meses), Copom, meta de inflação, retenção de
  dividendos (Lei 15.270), JCP, isenção de FII, IR de ETF e isenção de R$ 20 mil em ações. Cada fato tem `value`,
  `data` estruturado, `source` (teste exige https e domínio oficial), `verifiedAt` (teste falha após 12 meses) e
  `check`. Achados que mudam o conteúdo das lições: **JCP é 17,5%** desde a LC 224/2025 (o backlog dizia 15%);
  **LCI/LCA têm prazo mínimo de 12/9 meses** (os exemplos de resgate em 60 dias das lições 1.5/1.6 são irreais
  para emissão nova); FGC não cobre CRI/CRA.
  **Ressalva (aceite não 100% atendido):** o Planalto derrubou a conexão (ECONNRESET) em todos os fetches, então
  11 dos 16 fatos estão com `check: 'trecho-de-busca'` (o órgão oficial aparece no resultado, mas a página não
  abriu para leitura integral). Cada `note` diz o que reabrir. **Reabrir esses textos é entrada obrigatória da
  RC.1.7**, antes de qualquer fato virar texto de lição. Ficam fora deste módulo, por serem fatos de lições novas:
  Selic/IPCA/VNA vigentes, pesos do IPCA, regra do VNA em deflação, resoluções CVM e circuit breaker (entram com
  as tarefas que os usam). Ainda não há teste "todo número de lição vem de um fato" (depende do conteúdo em
  blocos da RC.3.1).

### RC.1.7 · Validação de todas as lições existentes (auditoria factual com pesquisa na web) ✅ concluída com ressalva (2026-10-04)

- **Escopo:** validar **cada uma das 35 lições atuais**, afirmação por afirmação (texto, número, exemplo, gabarito
  de pergunta, revelação, `centralConcept`, `unlocksDescription`), contra fonte primária pesquisada na web. Os
  anexos `audit-licoes-*.md` são o ponto de partida, mas foram feitos por leitura e busca de notícia: esta tarefa
  refaz a checagem em fonte oficial e fecha todos os itens *[reconferir]* e *[verificar]*. Entrega
  `.claude/revisao-trilhas-anexos/validacao-licoes.md` com, por lição: lista de afirmações checadas, veredito
  (correto, impreciso, errado, desatualizado, específico da plataforma), fonte primária com URL e data de acesso,
  correção proposta, e se a afirmação deve virar fato no módulo RC.1.3 ou bloco "Na plataforma".
- **Também valida:** coerência com o motor (peso de ativo em ETF x seed, taxas citadas x catálogo, periodicidade
  de proventos x `fundamentals`/`dividend`), fórmulas recalculadas (preços de título, taxa bruta equivalente,
  IR regressivo) e a ordem de termos.
- **Cobertura obrigatória:** 0.1-0.5, 1.1-1.11, 2.1-2.5, 2.6.1-2.6.6, 2.7-2.10, 3.1-3.4 (35). Nenhuma lição fica
  de fora, e o relatório lista as 35 mesmo quando o veredito é "correta".
- **Aceite:** 35 lições com veredito e fonte; zero itens *[reconferir]* restantes; fatos regulatórios gravados em
  RC.1.3; lista de correções vira checklist de entrada de cada tarefa da Fase 5.
- **Depende de:** RC.1.3 (estrutura do módulo). **Bloqueia a Fase 5.**
- **Repetição:** ao fim da Fase 5, RC.8.1 repete a validação sobre o conteúdo novo (43 lições).
- **Entregável (2026-10-04):** `.claude/revisao-trilhas-anexos/validacao-licoes.md` com as 35 lições (afirmação,
  veredito, evidência, correção), 11 achados transversais (T1 a T11), tabela de itens sem fonte primária com a
  decisão de cada um e checklist de entrada por tarefa da Fase 5. `regulatoryFacts.ts` foi de 17 para 24 fatos:
  texto de lei **lido** no Planalto (por `curl`; o `WebFetch` falhava) para IR regressivo, IOF, poupança,
  isenção de LCI/LCA/CRI/CRA, isenção de FII, isenção de R$ 20 mil, retenção de dividendos, JCP, 95% de FII,
  PN e dividendo obrigatório; meta de inflação lida no Relatório de Política Monetária do Banco Central; prazo
  mínimo de LCI lido no consolidado da Res. CMN 4.410. **Correções importantes:** (a) Copom do motor é a cada
  **45** dias simulados e as lições dizem 21; (b) ciclo de relatório do motor é 91 dias e a 2.7 diz 14;
  (c) SINT11 tem banco a 20%, a 2.9 diz 35%; (d) taxas das lições não batem com o catálogo; (e) **corrigem a
  auditoria**: dividendo obrigatório (metade do lucro, não 25%), liquidação D+2 (não D+1), 5 anos de LTN
  (573,80, não 575,77); (f) **corrigem a RC.1.3**: prazo mínimo de LCI é 6 meses/36 meses (os 12/9 meses eram de
  02/2024) e JCP é 17,5% desde 01/01/2026.
  **Ressalva (aceite não 100% atendido):** o aceite pedia "zero itens reconferir". Ficaram 7 fatos com
  `trecho-de-busca` (Copom/horário, IR de ETF, ticker/liquidação da B3, ITR/DFP, VNA, IPCA, e o prazo de LCA
  não confirmado no consolidado). A tabela "Itens sem fonte primária" dá a decisão de cada um: ou a lição não
  afirma, ou reabre a fonte antes. A página do Banco Central e do IBGE só abrem com JavaScript e a do Tesouro
  Direto devolve 403 a clientes automatizados; reabrir no navegador na RC.5.3 e na RC.8.1. Validou:
  `vitest`, `lint` e `build` do backend.

### RC.1.4 · Limpar vazamentos de desenvolvimento (correção mecânica) ✅ concluída com ressalva (2026-10-04)

- **Escopo:** remover/reescrever tudo que a varredura achou: `centralConcept` da 0.2 e 2.4/2.5 ("TCC cap. ..."),
  1.2 ("spec do TCC"), 2.6.5 e 2.7 ("spec 3.2.2"); metodologia dos ETFs no `engine/cmd/seed` (nomes de coluna,
  "SINT11", "do catálogo"); nomes dos ativos Sandbox ("Lição 2.3", "Lição 1.7"); `IndicatorSummaryCards`
  ("Aguardando primeiro tick"); chaves `tcc.*` do storage (migração de leitura retrocompatível, não logar o
  usuário para fora); travessões em templates de macroevento e cópias do frontend, `OrderConfirmationDialog`,
  `seedMissions`.
- **Aceite:** RC.1.1 verde; usuário logado continua logado após a troca de chave de storage.
- **Depende de:** RC.1.1.
- **Entregável (2026-10-04):** *Backend:* `centralConcept` da 0.2 e 2.5, "spec do TCC (cap. 3)" da 1.2 e "(spec 3.2.2)"
  da 2.6.5 reescritos sem a referência; `completionCriteria` das missões sem travessão. *Engine:* nomes dos ativos
  de treino viraram "Ação de Treino" e "Tesouro Prefixado de Treino"; metodologia dos ETFs sem nome de coluna,
  `SINT11` nem "do catálogo"; travessões dos 4 templates de macroevento trocados por pontuação. Como o seed pula
  ativo que já existe, a migration `000040_clean_visible_catalog_text` aplica a mesma correção em bancos já
  semeados (idempotente, testada num Postgres descartável). *Frontend:* "Aguardando a primeira atualização" no lugar
  de "primeiro tick", "Recotada pelo mercado", travessões do `OrderConfirmationDialog` e da tela de Indicadores;
  chaves de storage `tcc.*` viraram `app.*` via `utils/storage`, que lê a chave antiga uma vez e migra (usuário
  logado continua logado; teste cobre). Baselines encolhidos nas três camadas. Validou: `npm test`/`lint`/`build`
  do backend (756), `vitest` (836)/`tsc -b` do frontend, `go test ./...` e `golangci-lint` v2 do engine.
  **Ressalva (aceite "zera os baselines" não 100% atendido):** o que sobra nos baselines é decisão de outra tarefa,
  não limpeza mecânica. (a) Nas lições, `nesta-plataforma`, `simulado`, `numero-de-licao`, `sandbox`, `motor` e
  `cartao-longo` só se resolvem reescrevendo o texto com o bloco "Na plataforma" (RC.3.3 e Fase 5); trocar agora
  seria reescrever conteúdo antes da validação por lição. (b) No frontend, "simulado"/"Sandbox"/"Modo Aprendizado"
  são nomes de produto da tela (Onboarding, Mercado, Classificação, `NetWorthCards`, que a D5/RC.7.4 decide).
  (c) No engine, as 5 mensagens de erro de domínio restantes (`temporizador...`, `outstanding_shares`) são texto
  interno que o tradutor da RC.1.5 mapeia por regex e nunca chega ao usuário; mudar o texto exigiria mudar o
  tradutor junto, sem ganho. Cada baseline restante é a lista de trabalho da tarefa dona.

### RC.1.5 · Erros do engine com código, nunca `err.message` cru na UI ✅ concluída (2026-10-04)

- **Escopo:** contrato de erro `{ code, message }` com mensagem em português para o usuário, mapeamento no
  backend (proxy) e no frontend (um único `formatApiError`). Sem expor `outstanding_shares`, `user_id e asset_id
  são obrigatórios` etc. Atualiza `.docs/backend/` e `.docs/engine/`.
- **Aceite:** teste varrendo todos os call sites de `err.message` em `pages/`/`components/`; erro novo sem
  mapeamento cai numa mensagem genérica, nunca no texto interno.
- **Depende de:** nada.
- **Entregável (2026-10-04):** o mapeamento fica no ponto único do proxy: `backend/src/modules/market/interfaces/http/
  engineErrorTranslator.ts` (+ teste) devolve `{ code, error }` com texto em português; mensagem fora da tabela cai
  num genérico pelo status e nunca vaza (`outstanding_shares`, "temporizador", "tick"). Erro com `code` próprio do
  motor (`market_closed`) passa 1:1. Frontend: `utils/formatApiError` (`formatApiError` com fallback por tela e
  `apiErrorCode`); `Login`, `Onboarding`, `Configuracoes`, `PrivacidadeLgpd`, `OrderConfirmationDialog` e
  `MacroEventTriggerForm` trocaram `err.message` por ele; `orderRejection` agora decide por `code`, não por trecho
  de texto. Teste `frontend/src/content/apiErrorMessages.test.ts` varre `pages/`, `components/` e `features/` e falha
  em qualquer `err.message` novo. Documentado em `.docs/backend/market.md`. **Decisão de escopo:** o engine em Go
  não foi alterado (centenas de call sites de texto livre); o contrato `{ code, message }` vale entre backend e
  frontend, e as mensagens internas do engine só aparecem em log. Se o autor quiser códigos nativos no engine,
  é tarefa separada. Validou: `vitest`, `lint`, `build` do backend (756 testes) e `vitest`, `lint`, `tsc -b` do
  frontend (832). **Não rodei `docker compose up`** (cobertura por supertest).

### RC.1.6 · Guia de redação de conteúdo educacional ✅ concluída (2026-10-04)

- **Escopo:** `.claude/diretrizes-redacao-licoes.md` (no molde de `diretrizes-redacao-eventos-macro.md`): bloco "Na
  plataforma", regra de termos, tom, uso de fatos regulatórios, checklist de revisão de lição, exemplos bom/ruim.
- **Aceite:** linkado no `CLAUDE.md`; usado como checklist nas tarefas da Fase 5.
- **Depende de:** nada.
- **Entregável (2026-10-04):** `.claude/diretrizes-redacao-licoes.md` (10 seções: leveza e teto de cartão, Brasil real e
  bloco "Na plataforma", termos, fatos regulatórios com fonte, contas por widget, checkpoints, tom e texto de UI,
  testes que já barram, checklist de 10 itens), com exemplos bom/ruim tirados dos achados reais (Copom 21 dias,
  taxas fora do catálogo, correções da própria auditoria). Linkado na tabela do `CLAUDE.md`. Só documentação, sem
  código. **Fecha a Fase 1.**

---

## Fase 2: Player de lição

Fonte: `analise-player-licao.md` (tarefas P.1-P.5 e P.10 lá). A migration nova deve respeitar a regra do journal
do Drizzle (`when` maior que o último aplicado; ver memória do projeto), e o upsert do seed continua sem remover
colunas.

### RC.2.1 · Revisar lições concluídas (P.1) ✅ concluída (2026-10-04)

- **Escopo:** player de lição `completed` abre no passo 0 em modo revisão, navega sem chamar `POST /progress`;
  endurecer o backend para `/progress` em lição concluída não escrever (hoje reescreve `current_step` e
  `microDecisionSelectedOption`, o que corromperia conquistas e missões de acerto); `reviewLesson` dispara ao
  chegar na Revelação (D2); rótulo "Rever" no nó do mapa; reescrever `Lesson/index.test.tsx:366-381`.
- **Aceite:** abrir lição concluída mostra o Cenário; nenhum POST em revisão; XP, streak, missões e conquistas
  inalterados (testes de backend e frontend).
- **Depende de:** D2.
- **Entregável (2026-10-04):** *Backend:* `AdvanceLessonUseCase` trata lição já concluída como só leitura (não grava
  passo nem escolha, não passa pelo gate; devolve passo gravado, `completed: true` e o veredito); teste novo prova que
  o progresso fica idêntico. *Frontend:* `pages/Lesson` decide o modo revisão uma vez, ao carregar (para concluir a
  lição agora não trocar o fluxo no meio), abre no Cenário, navega só no cliente sem `POST /progress`, e `reviewLesson`
  dispara ao chegar na Revelação (D2). `TrackPath` mostra o rótulo "Rever" nos nós concluídos. Testes antigos de
  `Lesson/index.test.tsx` reescritos; `.docs/backend/lessons.md` atualizado. Validou: `npm test`/`lint`/`build` do
  backend (764), `vitest` (846)/`tsc -b`/lint do frontend. **Ressalvas:** (a) em revisão de lição com aposta real, o
  badge de acerto/erro da Revelação não aparece (o veredito vem do servidor e a revisão não faz POST); a revisão
  stateless é escopo da RC.2.4. (b) Não rodei `docker compose up` nem o e2e `lessonJourney`.

### RC.2.2 · Botão Voltar (P.2) ✅ concluída (2026-10-04)

- **Escopo:** reducer de navegação (`useLessonNavigation`), Voltar entre cartões e fases (exceto o primeiro
  cartão do Cenário), preserva escolha, veredito e revelações; reavançar fases já vistas não chama o POST (sem 422
  por intervalo de 5 s ou passo fora de ordem); teclado e leitor de tela.
- **Aceite:** voltar e reavançar em qualquer ponto sem erro nem espera; estado preservado.
- **Depende de:** RC.2.1.
- **Entregável (2026-10-04):** `features/lessons/useLessonNavigation` (reducer + hook, com testes) guarda fase,
  cartão, fase mais avançada já alcançada (`reached`) e cartões `[revelar]` já abertos (chave `fase:cartão`, não zera
  ao avançar nem ao voltar). `pages/Lesson` troca os estados soltos (`localStep`, `subStep`, `revealedIndexes`) por
  esse hook. Botão "Voltar" (secundário, à esquerda do CTA) em todos os cartões e fases, exceto o primeiro do Cenário;
  do primeiro cartão de uma fase cai no último da anterior. Reavançar até `reached` (fase já gravada no servidor, ou
  tudo em revisão) é só navegação local, sem `POST /progress`, então não há 422 de intervalo/ordem. Voltar à pergunta
  já passada não pede escolha de novo e desabilita as alternativas (resposta aceita não troca). Teclado: setas
  esquerda/direita clicam Voltar/Continuar (ignoradas com foco em input/slider ou modificador; herdam o `disabled`);
  o botão tem `aria-label`. Validou: `vitest` (suíte completa), `tsc -b`, oxlint; 6 testes novos de página.
  **Ressalvas:** (a) o veredito/badge da Revelação só existe na sessão em que a aposta foi enviada; voltar e
  reavançar o preserva, mas após recarregar a página ele não volta (isso é da revisão stateless, RC.2.4). (b) Sem
  conferência visual do botão nos 3 breakpoints nem `docker compose up`. (c) `CardDots` continua decorativo (o
  "contador clicável" era opcional).

### RC.2.3 · Backend da pergunta que só avança ao acertar (P.3) ✅ concluída (2026-10-04)

- **Escopo:** migration aditiva (`attempts`, `solved_at`, `hints`, backfill), `AnswerMicroDecisionUseCase`,
  `POST /lessons/:id/answer` (Zod), primeira escolha imutável, gabarito só em acerto (D3), gate 1->2 exige aposta
  resolvida (`422 micro_decision_unsolved`; quem já passou não é afetado), não toca `updated_at`, XP fixo (D1),
  sem dicas por alternativa (D3/D4: erro desativa a opção errada), `.docs/backend/lessons.md`. Suporte a múltiplas perguntas por lição (ver RC.3.2).
- **Aceite:** testes de caso de uso (fakes), router (supertest) e adapter (Postgres descartável); migration
  testada com progresso real; conquistas/missões H.1/H.3 inalteradas para dados antigos.
- **Depende de:** D1, D3, D4.
- **Entregável (2026-10-04):** migration `0022_add_lesson_micro_decision_attempts` (colunas `micro_decision_attempts`,
  `micro_decision_wrong_options smallint[]` e `micro_decision_solved_at`, com backfill de quem já passou da pergunta;
  `when` 1791400000000, acima da 0021 da branch da Fase N, que ainda não está na `main`, então o número 0022 evita
  colisão no merge; snapshot escrito à mão). `AnswerMicroDecisionUseCase` + `POST /lessons/:id/answer` (Zod): primeira
  escolha imutável, tentativas ilimitadas, erro devolve só as alternativas erradas já tentadas (a UI as desativa),
  gabarito só no acerto, lição concluída ou pergunta resolvida respondem sem gravar, `UPDATE` atômico que preserva
  `updated_at`. `AdvanceLessonUseCase`: gate 1->2 (`422 micro_decision_unsolved`, só nessa transição, quem já passou
  não é afetado); `selectedOption` em `/progress` virou deprecado e ignorado, e o veredito saiu dessa resposta
  (entregaria o gabarito). `GET /lessons/:id` devolve `microDecisionSolved` e `microDecisionWrongOptions`. Export LGPD
  inclui `microDecisionAttempts`. `.docs/backend/lessons.md` atualizado e helper e2e `support/lessons.ts` resolve a
  pergunta antes de avançar. Validou: `npm test`/`lint`/`build` (775) e, num Postgres descartável, migration com
  progresso real (backfill), as três respostas em sequência e `updated_at` intacto.
  **Atenção:** o frontend ainda envia a escolha em `/progress`, então **numa lição com pergunta o player fica preso no
  passo 1 até a RC.2.4 sair; as duas precisam ir juntas para a `main`.** **Ressalvas:** (a) múltiplas perguntas por
  lição (RC.3.2) não entraram: hoje há uma pergunta por lição, em colunas da linha de progresso; o desenho por
  pergunta fica para quando o contrato `blocks` existir. (b) Limite de taxa em `/answer` não implementado (tentativas
  são ilimitadas por decisão; com 2 a 4 alternativas não há o que proteger). (c) Não rodei `docker compose up` nem
  o e2e (só ajustei o helper).

### RC.2.4 · Frontend da pergunta (P.4) ✅ concluída com ressalva (2026-10-04)

- **Escopo:** botão Responder, erro desativa a alternativa escolhida (sem dicas), travar após acerto, "acertou de primeira"/"na Nª
  tentativa", revisão stateless, adaptar `useAdvanceLesson`/serviços, atualizar `backend/test/e2e/support/lessons.ts`
  (senão `equityOrderJourney` e `fixedIncomeRedemptionJourney` quebram) e criar `lessonJourney.e2e.test.ts`.
  `aria-invalid`, `role=alert`, foco.
- **Aceite:** errar nunca avança; tentativas ilimitadas; jornadas e2e existentes verdes.
- **Depende de:** RC.2.2, RC.2.3.
- **Entregável (2026-10-04):** *Serviços:* `answerMicroDecision` (`POST /lessons/:id/answer`) e hook
  `useAnswerMicroDecision`; `advanceLesson`/`useAdvanceLesson` não enviam mais `selectedOption`; tipos ganham
  `AnswerMicroDecisionResult`, `microDecisionSolved` e `microDecisionWrongOptions` e perdem o veredito de
  `AdvanceLessonResult`. *Player:* botão Responder; erro descarta a alternativa (desativada, riscada, com texto para
  leitor de tela), mostra aviso `role="alert"` que recebe o foco, sem dica nem gabarito; acerto trava as alternativas,
  mostra "Acertou de primeira"/"Acertou na Nª tentativa" (`role="status"`) e só então libera Continuar; a Revelação
  mostra o mesmo selo. Ao recarregar, restaura erros gravados e pergunta resolvida ("Você já resolveu esta pergunta").
  Revisão de lição concluída é sem estado: pergunta respondível de novo, Continuar nunca travado. Falha de rede mostra
  erro sem descartar a alternativa. O selo "Quase" saiu (errar não avança mais). Testes: 7 novos do player,
  `lessonJourney.e2e.test.ts` novo (erra, tenta de novo, acerta, 422 sem acertar, `selectedOption` antigo ignorado,
  revisão sem mudar XP/streak/progresso); o helper e2e `support/lessons.ts` já tinha sido ajustado na RC.2.3.
  Validou: `vitest` (suíte completa), `tsc -b`, oxlint. **Ressalvas:** (a) **a jornada e2e nova não foi executada**:
  a stack do `docker compose` não sobe nesta máquina porque o volume do Postgres está numa migration do engine
  (versão 46) que esta árvore não tem (`no migration found for version 46`), então o cadastro (que cria a conta de
  mercado no engine) falha; só passou `tsc`/prettier. Rodar com a stack da branch da Fase N ou um volume limpo.
  (b) Sem conferência visual nos 3 breakpoints. (c) Após recarregar, o selo "acertou de primeira" da Revelação não
  volta (o `GET` não devolve tentativas); só "Você já resolveu esta pergunta". (d) Em lição só leitura o servidor não
  devolve erros, então os descartados em revisão valem só na sessão.

### RC.2.5 · `LockedGate` unificado (P.5) ✅ concluída (2026-10-04)

- **Escopo:** rascunho/mockup primeiro. Componente único com variantes `screen`, `section`, `inline`, mesmo
  tamanho e estilo por variante, cadeado inequívoco, textos sem código de lição, claro/escuro, 3 breakpoints.
  Migra `LockedScreen`, `AssetDetail:91`, `FixedIncomeDetail:71`, `OrderConfirmationDialog:155` e remove
  `LockedAssetPanel`. Respeita a regra de CTA que nunca aponta para lição ainda não alcançada (Fase N do backlog de
  engajamento).
- **Aceite:** o card tem a mesma largura/altura relativa em todas as telas da mesma variante.
- **Depende de:** nada (paralelizável).
- **Entregável (2026-10-04):** `components/organisms/LockedGate` (variantes `screen`, `section`, `inline`) substitui
  `LockedAssetPanel` e `LockedScreen` (removidos, com testes portados). Largura máxima, selo e padding fixados pela
  variante (screen 640px/selo 96px, section 560px/64px, inline 420px/36px), nunca pelo contêiner; borda tracejada e
  selo âmbar (`--color-gamify-*`, ícone de cadeado grande); no desktop (>= 1024px) a `screen` vira selo à esquerda e
  texto/CTA à direita; no mobile o CTA ocupa a largura toda; título em `h2`, `role="status"` na `screen` e
  `role="note"` nas demais. Migrados `RequiresUnlock` (screen), `AssetDetail`/`FixedIncomeDetail` (section, sem o
  `<main>` duplicado dentro do `main` do AppShell) e `OrderConfirmationDialog` (inline). Texto e regra do CTA
  (nunca código de lição, `reachable: false` cai no Mapa) preservados. Validou: `vitest` (845), `tsc -b`, oxlint.
  **Ressalvas:** (a) não houve mockup separado nem conferência visual em 360/768/1280px, nos dois temas (sem
  `docker compose up` nesta sessão); a composição foi definida só em CSS e precisa de uma olhada no navegador antes
  de fechar. (b) Não apliquei a linha "Faltam N lições" opcional da proposta.

### RC.2.6 · Limpeza de comentários e tipos obsoletos ✅ concluída (2026-10-04)

- `pages/Lesson/index.tsx:33-38` e `domain/lesson.ts:24-27` citam um checkbox "já pensei" que não existe. Corrigir
  na primeira tarefa que tocar nesses arquivos.
- **Entregável:** comentários que descreviam um checkbox "já pensei" inexistente reescritos em `frontend/src/pages/Lesson/index.tsx`, `frontend/src/services/lessons/types.ts`, `backend/src/modules/lessons/domain/lesson.ts` e `backend/src/db/schema.ts` (só comentário, sem mudança de comportamento). Ficam de propósito as menções históricas em `schema.ts` (B.1) e `seedLessons.ts` (auditoria B.4). Validou: `tsc --noEmit` nos dois pacotes e `prettier --check`.

---

## Fase 3: Infraestrutura de conteúdo visual

### RC.3.1 · Contrato `blocks` e registro de widgets (P.6) ✅ concluída com ressalva (2026-10-04)

- **Escopo:** coluna `blocks` jsonb aditiva com fallback ao texto legado; registro de widgets no frontend com Zod
  por widget; `WidgetBoundary` (erro num widget não derruba a lição); `aria-live` e resumo textual por widget;
  `prefers-reduced-motion`; layout desktop em duas colunas (rascunho antes); bloco `callout`; migração dos 4
  widgets existentes (`growth_calculator`, `fixed_income_comparison`, painéis de indicador) para o registro.
- **Aceite:** lição sem `blocks` renderiza igual a hoje; `blocks` inválido cai no legado; contrato testado no
  front e no back.
- **Depende de:** RC.2.2. **Entrega antes do editor da N.23** (o editor já nasce sobre o contrato).
- **Entregável (2026-10-04):** *Backend:* migration `0023_add_lesson_blocks` (`lessons.blocks jsonb`, nulo = texto
  legado; `when` 1791500000000, snapshot escrito à mão); contrato Zod em `modules/lessons/infrastructure/content/
  lessonBlocks.ts` (o domínio não importa lib externa, então os tipos ficam em `domain/widgets/lessonBlocks.ts`):
  `{ schemaVersion: 1, phases: { scenario, microDecision, revelation } }` de blocos `text` ou `widget` (`id` único,
  props validadas por widget), leitura tolerante (fora do contrato vira `null`), `GET /lessons` e `/:id` devolvem
  `blocks`, seed aceita `blocks` e o inclui no `set` do upsert; `.docs/backend/lessons.md` atualizado. *Frontend:*
  `zod` adicionado; espelho do contrato em `features/lessons/widgets/schema`, `features/lessons/playerCards`
  (blocos viram cartões; widget = cartão próprio; fase sem blocos usa o texto legado), registro único em
  `components/organisms/LessonWidget` (componente + schema + resumo textual por widget, `role="group"` com o resumo),
  `WidgetBoundary` (erro de render vira fallback só do widget), widget desconhecido ou props inválidas viram
  fallback (legenda ou aviso discreto), `LessonCallout` (tom info/dica/aviso por ícone e borda, nunca ganho/perda),
  `prefers-reduced-motion` no contêiner. Os 4 widgets existentes passaram pelo registro (`growth-calculator`,
  `fixed-income-comparison`, `live-indicator`, `live-macro`); os tipos legados `microDecisionType` renderizam pelo
  mesmo registro quando a fase não tem blocos. Desktop (>= 1024px): cartão de widget em duas colunas (texto/CTA à
  esquerda, widget à direita, página até 1040px via `:has`). Validou: backend lint/build/`npm test` (788), frontend
  `vitest` (884)/`tsc -b`/oxlint; contrato testado nos dois lados com o mesmo exemplo. **Ressalvas:** (a) sem
  rascunho/mockup do desktop em duas colunas e sem conferência visual nos 3 breakpoints nem `docker compose`
  (a migration só foi escrita, não aplicada num Postgres; o ambiente local está num volume de outra branch);
  (b) nenhuma lição do seed usa `blocks` ainda (fica para a Fase 5), então o caminho novo só é exercitado por testes;
  (c) `aria-live` está nos estados de carregamento dos widgets ao vivo; os widgets de cálculo existentes mantêm o
  próprio markup, sem região `aria-live` nova; (d) `requiresInteraction` do desenho original ficou fora.

### RC.3.2 · Pergunta intermediária como bloco ✅ concluída com ressalva (2026-10-04)

- **Escopo:** bloco `checkpoint` (single, V/F, numérica com tolerância) com explicação mostrada após o acerto, erro desativa a alternativa escolhida
  (sem dicas) e tentativas ilimitadas; contagem de acertos de primeira por lição; reaproveita o endpoint de RC.2.3.
- **Aceite:** 3 a 7 checkpoints por lição suportados sem mudar o XP total (D1); progresso salvo ao sair e voltar.
- **Depende de:** RC.2.3, RC.3.1.
- **Entregável (2026-10-04):** *Modelagem (decidida aqui):* o gabarito mora no próprio bloco `check` de
  `lessons.blocks` (servidor), `toPublicBlocks` o remove de `GET /lessons` e `/:id` (sem `answer`, `tolerance`,
  `explanation`); o estado do aluno fica em tabela nova `user_lesson_checkpoints` (migration `0024`, uma linha por
  usuário, lição e checkpoint: tentativas, alternativas erradas, `solved_at`), em vez de colunas na linha de progresso.
  *Backend:* tipos `single` (2 a 4 alternativas), `true_false` e `numeric` (tolerância e unidade), até 7 por lição,
  `id` único junto com os widgets (Zod); `AnswerCheckpointUseCase` + `POST /lessons/:id/checkpoints/:checkpointId/
  answer` (mesmas regras da RC.2.3: erro só desativa a alternativa, explicação só no acerto, tentativas ilimitadas,
  lição concluída ou checkpoint resolvido responde sem gravar, upsert atômico); `GET /lessons/:id` devolve
  `checkpoints` e `checkpointsFirstTry`; gate no `/progress`: sair de uma fase sem resolver as `check` dela dá
  `422 checkpoint_unsolved` (só na transição, quem já passou não é afetado); XP inalterado (D1). `.docs/backend/
  lessons.md` atualizado. *Frontend:* contrato espelhado, `PlayerCard` ganha `check`, hook `useCheckpoints` (estado do
  servidor + sessão; em revisão ignora o servidor e nada trava), `LessonCheckpoint` (alternativas ou campo numérico
  com vírgula, aviso `role="alert"` com foco, `aria-invalid`, selo "de primeira"/"Nª tentativa", explicação no acerto),
  Continuar travado no cartão da pergunta até acertar. Validou: backend lint/build/`npm test` (826) e frontend
  `vitest`/`tsc -b`/oxlint, com testes de caso de uso, rota, gate, schema e página (inclui 7 perguntas na mesma
  fase e restauração ao reabrir). **Ressalvas:** (a) migration `0024` só escrita, não aplicada num Postgres, e sem
  `docker compose`/e2e (o ambiente local está num volume de outra branch); (b) ao reabrir uma pergunta já resolvida
  o servidor não devolve a explicação (só no acerto), então aparece "Você já resolveu esta pergunta."; (c) o export
  LGPD de progresso ainda não inclui as respostas dos checkpoints; (d) nenhuma lição do seed usa `check` ainda
  (Fase 5); (e) sem conferência visual nos 3 breakpoints.

### RC.3.3 · Bloco "Na plataforma" ✅ concluída com ressalva (2026-10-04)

- **Escopo:** componente `PlatformNote` com *No Brasil / Aqui / Por quê*, visual distinto (selo, cor de token),
  aceito pelo teste RC.1.1 como único lugar permitido para a palavra "plataforma".
- **Aceite:** usado nas lições que divergem do real (Copom, Selic simulada, calendário, catálogo fictício).
- **Depende de:** RC.3.1.
- **Entregável (2026-10-04):** o bloco é o widget `platform-note` (props `brazil`, `here`, `why`, as três
  obrigatórias e não vazias), registrado nos dois lados do contrato (`lessonBlocks.ts` do backend e `widgets/schema`
  do frontend, mesmo exemplo de contrato com o bloco nos dois testes). Componente `components/organisms/PlatformNote`
  (selo "Na plataforma" com ícone, borda tracejada na cor da marca, lista No Brasil / Aqui / Por quê; em >= 768px
  rótulo e texto lado a lado), com `platformNoteSummary` como resumo textual no registro. *Teste de conteúdo:* a
  pasta `PlatformNote` ficou fora da varredura do frontend e o backend passou a varrer os textos de `blocks`
  (`blockTextFields` em `contentRules.ts`: markup, callout, check, caption), isentando só o `platform-note` das
  regras `nesta-plataforma`, `simulado`, `sandbox` e `motor` (TCC, travessão etc. continuam valendo). `.docs/backend/
  lessons.md` atualizado. Validou: backend lint/build/`npm test` (829) e frontend `tsc -b`/oxlint/`vitest` (895).
  **Ressalvas:** (a) nenhuma lição do seed usa o bloco ainda (a Fase 5 o usa em Copom, Selic simulada, calendário);
  (b) sem conferência visual nos 3 breakpoints nem `docker compose`; (c) o seed ainda não valida `blocks` contra o
  schema além do teste de conteúdo.

### RC.3.4 · Biblioteca de widgets (agrupada em sessões)

Cada widget: Zod das props, `summary` textual, `aria-live`, responsivo, teste table-driven da fórmula. Detalhe de
entradas, saídas e fórmulas em `audit-licoes-*.md` e `analise-player-licao.md` §5.

| Sessão | Widgets | Lições que consomem |
|---|---|---|
| RC.3.4a Cálculo de renda fixa ✅ | `equivalent-rate` (taxa bruta equivalente, presets 60/720 dias), `ir-regressive-table`, `product-comparator` (líquido vs bruto, breakeven) | 1.4, 1.5, 1.6, 3.3 |
| RC.3.4b Risco e proteção ✅ | `mtm-seesaw` (gangorra de marcação a mercado: taxa x preço, prazo, Prefixado/IPCA+/Selic, choques), `fgc-coverage-bar` (R$ 250 mil por conglomerado, teto R$ 1 milhão em 4 anos, guarda-chuva), `rating-ruler` | 1.4, 1.8, 1.11 |
| RC.3.4c Juros e inflação ✅ | `compound-growth` (substitui `growth_calculator`), `real-return`, `selic-ipca-chart` (série com faixa da meta), `copom-timeline` (8 reuniões/ano) | 0.2-0.5, 1.2, 1.3, 1.9, 1.10 |
| RC.3.4d Títulos ✅ | `bond-price-calculator` (preço/deságio, IR e custódia, LTN x NTN-F), `ipca-plus-simulator` (VNA, ano a ano), `breakeven-inflation` | 1.7, 1.10 |
| RC.3.4e Ações, parte 1 ✅ | `ownership-calculator`, `bookbuilding-simulator`, `ticker-decoder` (arrastar), `headline-triage`, `order-book` (livro de ofertas interativo; G) | 2.1-2.5 |
| RC.3.4f Ações, parte 2 ✅ | `interactive-balance` (DRE em cascata + Ativo = Passivo + PL; G), `margin-comparator`, `roe-lab` (DuPont), `multiples-calculator`, `debt-thermometer` (choque de Selic) | 2.6.1-2.6.5 |
| RC.3.4g Proventos e fundos ✅ | `dividend-timeline` (data com, ex, pagamento), `dividend-net-calculator` (dividendo/JCP líquido, regra de 2026), `etf-shock-simulator`, `fii-monthly-calendar` | 2.6.6, 2.7, 2.9, 2.10 |
| RC.3.4i Vida real | `budget-split`, `debt-snowball`, `pay-or-invest`, `emergency-fund-calculator`, `where-to-keep`, `equity-tax-calculator`, `tax-decision-tree`, `fee-drag`, `behavior-bias-quiz` | RC.4.4 a RC.4.9 |
| RC.3.4h Planejamento ✅ | `risk-return-scatter`, `allocation-donut`, `risk-profile-quiz` | 3.1, 3.2, 3.4 |

- **RC.3.4a entregue (2026-10-04):** três widgets registrados nos dois lados do contrato (props todas com
  default): `equivalent-rate` (`exemptRatePct`, `cdbRatePct`, `daysPresets`: presets de prazo + campos livres,
  mostra IR do prazo, taxa bruta equivalente, taxa líquida do CDB e o vencedor), `ir-regressive-table` (`grossYield`,
  `initialDays`: controle deslizante de prazo, faixa atual marcada com "▶" e `aria-current`, IR e líquido em R$) e
  `product-comparator` (`products` 2 a 3 com `liquidity`/`fgc` opcionais, `amount`, `days`: líquido de cada um e
  vencedor com "★"). Contas em funções puras `features/lessons/widgets/fixedIncomeMath` (tabela regressiva
  espelha o fato `ir-renda-fixa-regressivo` de `regulatoryFacts.ts`; capitalização anual `(1+i)^(dias/365)`), com
  teste table-driven; cada componente com teste de interação e `aria-live` no resultado, resumo textual no registro
  e CSS compartilhado `LessonWidget/widgetControls.module.css` (campos em 3 colunas só a partir de 768px).
  `.docs/backend/lessons.md` atualizado. Validou: frontend `tsc -b`/oxlint/`vitest` (931), backend
  lint/build/`npm test` (831). **Ressalvas:** (a) nenhuma lição usa os widgets ainda (a RC.5.5 reescreve a 1.6 e
  1.4/1.5 com eles); (b) a taxa equivalente é a razão simples sobre a taxa anual, a aproximação padrão, enquanto o
  comparador usa capitalização composta, então os dois podem divergir em frações de ponto percentual em prazos
  curtos; (c) a tabela de IR está duplicada entre backend (fato) e frontend (constante), sem teste que as cruze;
  (d) sem conferência visual nos 3 breakpoints nem `docker compose`; (e) não incluem o IOF dos primeiros 30 dias.
- **RC.3.4c entregue (2026-10-04):** quatro widgets registrados nos dois lados do contrato (props todas com default):
  `compound-growth` (`initial`, `monthly`, `ratePct`, `rateUnit`, `months` até 480, `showSimple`: campos de capital e
  aporte, controles deslizantes de taxa e prazo, `GrowthChart` e, com `showSimple`, o valor dos juros simples e a
  diferença em R$; reusa `computeGrowthProjection`, então bate com a Calculadora), `real-return` (`nominalPct`,
  `inflationPct`, `amount`: três barras com o valor escrito, rendimento real por Fisher `(1+n)/(1+i)-1` e o valor em
  reais de hoje; barra negativa listrada, nunca só cor), `selic-ipca-chart` (`windowDays`: Selic em linha contínua e
  IPCA 12 meses tracejada na mesma escala, faixa da meta de 3% com tolerância de 1,5 p.p. sombreada, lê a série pelo
  `useIndicatorHistoryQuery`; estados de carregando e histórico curto) e `copom-timeline` (sem props: 8 marcos
  selecionáveis, decisão no segundo dia, comunicado a partir das 18h30, cerca de 45 dias entre reuniões, sem datas de
  calendário). Contas em `features/lessons/widgets/macroMath` e layout do gráfico em `selicIpcaChartLayout`, ambos com
  teste table-driven; constantes espelham os fatos `meta-inflacao` e `copom-reunioes` de `regulatoryFacts.ts`. CSS
  novo (barras, gráfico, linha do tempo) em `widgetControls.module.css`. `.docs/backend/lessons.md` atualizado.
  Validou: frontend `tsc -b`/oxlint/`vitest` (1378), backend lint/build/`npm test` (2694). O teste de conteúdo
  proibido barrou "simulado" e "Na plataforma" nos widgets (só valem no bloco "Na plataforma"), então a prop
  `showPlatformCadence` do desenho original saiu: o ritmo de 21 dias simulados do Copom da plataforma é escrito no
  bloco "Na plataforma" da lição, não no widget. **Ressalvas:** (a) nenhuma lição usa os widgets ainda (RC.4.1 e RC.5.2
  são as primeiras consumidoras); (b) `growth-calculator` continua registrado, porque as lições de hoje ainda o
  referenciam; a troca é a Fase 5; (c) sem conferência visual nos 3 breakpoints nem `docker compose`; (d) os limites de
  `windowDays` (7 a 365) seguem o `live-macro`, sem teste contra a janela real do motor.
- **RC.3.4b entregue (2026-10-05):** três widgets registrados nos dois lados do contrato (props todas com default):
  `mtm-seesaw` (`contractRatePct`, `yearsToMaturity`, `indexer`: gangorra em SVG que inclina com a taxa de mercado,
  controles de taxa e prazo, seletor Prefixado/IPCA+/Selic, cenários "sobe 1 p.p.", "sobe 2,5 p.p.", "cai 1 p.p.";
  preço de compra, preço hoje e variação; Selic reprecifica todo dia, então usa prazo de 1 dia útil e quase não se
  mexe; `prefers-reduced-motion` sem transição), `fgc-coverage-bar` (`amountPerInstitution`, `institutions`,
  `sameConglomerate`: uma barra por instituição com trecho coberto sólido e descoberto listrado, teto global de R$ 1
  milhão e soma por conglomerado) e `rating-ruler` (`highlight`: 10 notas de AAA a D, borda contínua para grau de
  investimento e tracejada para especulativo, significado de cada nota). Contas em `features/lessons/widgets/mtmMath`
  e `fgcMath` (puras, teste table-driven; `fgcMath` espelha os fatos `fgc-limite-por-cpf` e `fgc-teto-global`).
  `.docs/backend/lessons.md` atualizado. Validou: frontend `tsc -b`/oxlint/`vitest` (1445), backend
  lint/build/`npm test` (2699). **Correção a um anexo:** os valores de 5 anos de `audit-licoes-1b.md` estavam
  errados (R$ 575,77 e queda de 9,8%); o correto é **R$ 573,80 e queda de 9,49%** (2 anos: 800,76, 769,47 e 826,45
  conferem). **Ressalvas:** (a) nenhuma lição usa os widgets ainda (RC.5.6 e RC.5.7 são as consumidoras; a 1.4 deve
  receber o `fgc-coverage-bar`); (b) a escala de rating é convenção das agências e não há fonte oficial na lista de
  fontes aceitas, então não virou fato em `regulatoryFacts.ts`: a lição deve dizer "escala usada pelas agências" e
  não citar norma; (c) a gangorra mostra preço bruto, sem IR, custódia nem o spread de compra e venda do Tesouro, e
  o IPCA+ usa a mesma conta sobre a taxa real (preço em % do valor atualizado, não em reais); (d) sem conferência
  visual nos 3 breakpoints nem `docker compose`; (e) `bond-price-calculator` e `ipca-plus-simulator` ficam na RC.3.4d.
- **RC.3.4d entregue (2026-10-05):** três widgets registrados nos dois lados do contrato (props todas com default):
  `bond-price-calculator` (taxa, prazo e valor: preço unitário, deságio em R$ e %, quantidade de títulos, bruto no
  vencimento, IR pela tabela regressiva pelo prazo em dias corridos e custódia da B3 de 0,20% ao ano, ganho líquido
  e taxa líquida anual; barra com o preço de hoje sólido e o deságio listrado), `ipca-plus-simulator` (tabela ano a
  ano de principal, correção da inflação e juros reais com IPCA constante, presets na meta 3%, no teto 4,5% e
  inflação alta 8%; líquido de IR e rendimento real líquido por Fisher, abaixo da taxa real anunciada) e
  `breakeven-inflation` (inflação de equilíbrio `(1+pre)/(1+real)-1` e quem rende mais para a inflação esperada).
  Contas em `features/lessons/widgets/treasuryMath` (puras, table-driven; reusa `bondPrice` e `irRatePctForDays`;
  a custódia espelha o fato `tesouro-custodia-b3`). `.docs/backend/lessons.md` atualizado. Validou: frontend
  `tsc -b`/oxlint/`vitest` (1472), backend lint/build/`npm test` (2702). **Correção a um anexo:** `audit-licoes-1b.md`
  dava R$ 1.215,2 para R$ 1.000 em 2 anos com IPCA 4% e taxa real 6%; o correto é **R$ 1.215,29** (e 10.000 a
  11,75% por 2 anos dá R$ 12.488,06 bruto). **Ressalvas:** (a) nenhuma lição usa os widgets ainda (RC.5.6 e RC.5.7 são
  as consumidoras); (b) o desenho previa "LTN x NTN-F", mas o cupom da NTN-F não tem fato verificado em
  `regulatoryFacts.ts`, então o widget cobre só o prefixado sem cupom, e a diferença para o título com juros
  semestrais fica como texto da lição depois de registrar o fato; (c) a custódia é aproximada (taxa x anos x valor
  investido, sem acompanhar o saldo diário) e o IOF dos primeiros 30 dias não entra (prazo mínimo do controle é 3
  meses); (d) o IPCA+ simulado não modela o VNA em reais nem a defasagem do IPCA, só o saldo relativo ao valor
  investido, e usa inflação constante (dito na tela); (e) sem conferência visual nos 3 breakpoints nem `docker compose`.
- **RC.3.4g entregue (2026-10-06):** quatro widgets registrados nos dois lados do contrato (props todas com default). `dividend-timeline` (`quantity`, `valuePerShare`, `comDay` 1 a 5, `paymentDay` 8 a 30: quatro marcos em dias úteis, o aluno escolhe comprar ou vender e o dia, e vê se recebe; a data ex é sempre o dia útil seguinte à data com; diz que o preço desconta o valor do provento na data ex), `dividend-net-calculator` (`quantity`, `valuePerShare`, `kind` dividendo ou JCP, `otherSameMonth`: bruto, retido, líquido e a regra aplicada; dividendo sem retenção até R$ 50 mil no mês da mesma empresa, 10% acima disso, caixa de lucro de 2025 aprovado até 31/12/2025 isento, JCP 17,5%), `etf-shock-simulator` (`holdings` 2 a 6 ativos que somam 100%, `navBefore`: choque por ativo, contribuição de cada um e a nova cota; cenários "A cai 20%", "Todos caem 10%" e "Zerar") e `fii-monthly-calendar` (`monthlyPerShare`, `shares`, `price`, `payoutBusinessDay` 5 a 15: 12 meses selecionáveis, data com no último dia útil, data ex no 1º dia útil do mês seguinte, pagamento no N-ésimo dia útil, Dividend Yield anual e a isenção de IR do rendimento nas condições da lei). Contas em `features/lessons/widgets/proventosMath` (puras, table-driven; as alíquotas espelham os fatos `dividendos-retencao-lei-15270` e `jcp-aliquota`). `.docs/backend/lessons.md` atualizado. Validou: frontend `tsc -b`/oxlint/prettier/`vitest` (1619), backend lint/build/`vitest` das lições. **Ressalvas:** (a) nenhuma lição usa os widgets ainda (RC.5.11, RC.5.13 e RC.4.7 são as consumidoras); (b) as constantes de alíquota estão duplicadas entre `proventosMath` e `regulatoryFacts.ts`, sem teste que as cruze (mesma ressalva da RC.3.4a); (c) o imposto mínimo de altas rendas não entra na calculadora (dito na tela); (d) o `dividend-timeline` não mostra o degrau de preço em gráfico, só o texto do desconto; o diagrama de creation e redemption do ETF e o comparativo tijolo x papel ficaram para a lição, não viraram widget; (e) o "Simulador" no texto visível foi evitado porque o teste de conteúdo proibido barra "simulado"; (f) sem conferência visual nos 3 breakpoints nem `docker compose`; `/code-review` não rodado.
- **RC.3.4e entregue (2026-10-05):** cinco widgets registrados nos dois lados do contrato. `ownership-calculator` (`price`, `totalShares`, `yourShares`, `profit`, `payoutPct`: fatia da empresa, valor dela, valor de mercado e dividendo proporcional ao que é distribuído; avisa que o lucro retido não vai ao bolso e que o máximo a perder é o investido), `bookbuilding-simulator` (`offeredShares`, `primaryPct`, `existingShares`: oito ordens de exemplo fixas, demanda acumulada por preço em barras, preço de corte, cobertura, caixa da empresa só da parte primária, dinheiro dos sócios vendedores, valor de mercado e diluição), `ticker-decoder` (6 tickers do catálogo de exemplo para classificar em ON, PN, fundo/ETF/unit ou fracionário, com a regra depois da resposta; botões, não arrastar), `headline-triage` (4 manchetes de exemplo: Selic e dívida, lucro abaixo do esperado, quebra de safra, promessa em rede social; explicação depois da resposta) e `order-book` (livro de 4 níveis de compra e 4 de venda, ordem a mercado ou limitada, preço médio, deslizamento, spread, fila, ondas de compradores e vendedores e reinício; só no navegador). Contas em `features/lessons/widgets/orderBookMath` (casamento de ordens em centavos inteiros) e `equityMath` (participação e bookbuilding), puras e table-driven, com os casos do anexo (spread de R$ 0,05, compra de 500 a R$ 10,07 médio, corte em R$ 20,00). `.docs/backend/lessons.md` atualizado. Validou: frontend `tsc -b`/oxlint/`vitest` (1512), backend lint/build/`npm test` (2705). **Ressalvas:** (a) nenhuma lição usa os widgets ainda (RC.4.2, RC.5.9 e RC.4.3 são as consumidoras); (b) o `order-book` não é o livro do motor: é um livro estático de exemplo, e a lição deve dizer que no mercado real há milhares de ordens (o "Na plataforma" fica para a RC.5.9); (c) `ticker-decoder` usa só os tickers do catálogo de exemplo e não cobre BDR (sufixos 32 a 35 sem fonte, fato `b3-ticker-sufixos`); (d) o gráfico de profundidade e a linha do tempo clicável do IPO, previstos no anexo como opcionais, ficaram de fora; (e) as manchetes do `headline-triage` são texto próprio, sem fonte, e o "Esperado x divulgado" do anexo virou uma das quatro perguntas, não um widget separado; (f) sem conferência visual nos 3 breakpoints nem `docker compose`.
- **RC.3.4f entregue (2026-10-05):** cinco widgets registrados nos dois lados do contrato (props todas com default; valores em milhões de reais, de exemplo; contas puras em `features/lessons/widgets/companyMath`, table-driven). `interactive-balance` (`netRevenue`, `costsPct`, `expensesPct`, `financialResult`, `taxPct`, `cash`, `fixedAssets`, `debt`, `otherLiabilities`: DRE em barras, da receita líquida ao lucro líquido, com custos, despesas, juros e imposto ajustáveis; abaixo, Ativo = Passivo + Patrimônio Líquido com o PL negativo avisado; diz que o PL é valor contábil e não o que a empresa vale na bolsa), `margin-comparator` (`a` e `b`: dois conjuntos de receita, lucro bruto, EBIT e lucro líquido editáveis, margens bruta, EBIT e líquida em barras e quem converte melhor; avisa que margem compara dentro do setor e que lucro pontual infla), `roe-lab` (`revenue`, `netIncome`, `assets`, `equity`, `selicPct`: ROE = margem x giro x alavancagem; o controle de dívida sobre o ativo mexe no patrimônio com o lucro fixo, o ROE sobe e o texto avisa que o risco subiu junto; compara com uma Selic de referência), `multiples-calculator` (`price`, `netIncome`, `equity`, `shares`, `selicPct`: LPA, VPA, P/L, P/VP, valor de mercado e rendimento do lucro contra a Selic de referência; prejuízo vira "sem sentido") e `debt-thermometer` (`grossDebt`, `cash`, `ebit`, `financialExpense`, `cdiSharePct`: dívida líquida, quantas vezes cabe no EBIT, barra, cobertura de juros e o botão "E se a Selic subir 3 pontos?" que encarece só a parte atrelada ao CDI; avisa que não vale para bancos). Cada um com `aria-live`, resumo textual no registro, teste de interação e teste do contrato Zod (props válidas e fora do limite). `.docs/backend/lessons.md` atualizado. Validou: frontend `tsc -b`/oxlint/`vitest` (1554), backend lint/build/`vitest` das lições. **Ressalvas:** (a) nenhuma lição usa os widgets ainda (a RC.5.10 reescreve a 2.7.1 a 2.7.5 com eles); (b) as faixas do termômetro (até 2x folgado, acima de 4x pesado) são didáticas e rotuladas assim, sem fonte: faixas de covenant e Dívida Líquida/EBITDA continuam fora (item sem fonte primária); (c) o imposto sobre o lucro é um controle livre, com padrão de 30%, sem fato registrado de alíquota (IRPJ e CSLL não foram abertos), e a lição não deve afirmar um número; (d) a Selic dos widgets de ROE e múltiplos é um valor de referência editável, e não a Selic do motor; (e) o painel de seis números da 2.7.1 (`EquityIndicatorsPanel`, que mostra 9 indicadores) segue por corrigir ou tirar da promessa na RC.5.10; (f) sem conferência visual nos 3 breakpoints nem `docker compose`; (g) `/code-review` não rodado.
- **Aceite geral:** nenhum texto manda calcular fora; nenhum botão "Ver resultado" solto (se sobrar, rótulo
  contextual); lint do seed barra "calcule" sem widget na mesma fase.
- **Depende de:** RC.3.1 (e RC.3.2 quando o widget traz checkpoint).

### RC.3.5 · Glossário ampliado e dicas inline ✅ concluída com ressalva (2026-10-04)

- **Escopo:** glossário estruturado (hoje 6 termos) com cerca de 40 termos, cada um com a lição de origem,
  definição curta, exemplo; tooltip/toque no primeiro uso do termo em cada lição; página de glossário (consulta).
  Inclui Selic, CDI, TR, IPCA, ticker, ON/PN, valor de face, VNA, alavancagem, payout, JCP, ITR/DFP, valor de
  mercado, NAV, ágio/deságio, spread, liquidez, duration, conglomerado financeiro, securitizadora.
- **Aceite:** RC.1.2 sem avisos; glossário acessível em todos os breakpoints.
- **Depende de:** RC.3.1.
- **Entregável (2026-10-04):** `features/lessons/glossary` virou catálogo estruturado (`{ definition, example?,
  originLesson? }`) com 49 termos (os 6 antigos mais Selic, CDI, TR, IPCA, ticker, ON e PN, valor de face, VNA,
  alavancagem, payout, JCP, ITR e DFP, valor de mercado, NAV, ágio, spread, liquidez, duration, conglomerado
  financeiro, securitizadora e outros); `originLesson` fica vazio para os termos cuja lição ainda não existe
  (Selic, CDI, TR, IPCA, ticker, ON e PN: RC.4.1/RC.4.2), para não haver link morto. *Primeiro uso:* o popover só
  aparece no primeiro uso do termo na lição (entre as três fases); depois vira texto puro
  (`termsSeenBeforeEachCard` em `playerCards`, derivado do conteúdo, sem estado, então Voltar e revisão não mudam).
  *Página `/glossario`* (`pages/Glossario`): ordem alfabética, busca sem acento, exemplo, link para a lição de
  origem; 1 coluna no mobile, 2 no tablet, 3 no desktop; link "Glossário" no cabeçalho do Hub de trilhas. Validou:
  frontend `tsc -b`/oxlint/`vitest` (903) e backend `npm test` (829). **Ressalvas:** (a) o aceite "RC.1.2 sem
  avisos" não é atingível aqui: o lint segue em modo aviso até as lições novas da Fase 4 existirem, e nenhuma lição
  do seed usa `{{Selic}}` etc. ainda (Fase 5); (b) definições e exemplos não passaram pela validação factual
  da RC.1.7 com fonte primária (são definições gerais; conferir TR, CDI e ON/PN na Fase 5); (c) sem conferência
  visual nos 3 breakpoints nem `docker compose`; (d) o glossário mostra todos os termos, não só os já vistos.

### RC.3.6 · Compatibilidade com o editor do painel (P.10)

- **Escopo:** quando N.23 for implementada: `upsertLessonSeed` insert-only para campos editáveis, editor com
  `blocks`/`hints`/checkpoints, preview idêntico ao player, patch de dados versionado para conteúdo novo.
- **Aceite:** reexecutar o seed não desfaz edição do admin; teste explícito.
- **Depende de:** RC.3.1, N.23.

---

## Fase 4: Estrutura da trilha (novas lições e ordem)

O currículo atual (35 lições) não foi avaliado como um todo contra o que um investidor brasileiro iniciante precisa
saber; RC.4.0 faz essa análise e amplia o escopo. As contagens de lições neste arquivo (37) valem só para RC.4.1 e
RC.4.2; com as seis lições aprovadas em RC.4.4 a RC.4.9 o currículo vai a 43.

Cada lição nova usa `stableKey` próprio e a progressão com dispensa (N.24) para não travar quem já passou.

### RC.4.0 · Análise de cobertura do currículo e lições novas ✅ concluída (2026-10-03)

- **Contexto:** o autor aprovou (2026-10-03) ampliar o currículo para além das 35 lições, e observou que ensinar
  esses assuntos abre espaço para **funcionalidades futuras no app** ligadas a eles. Temas aprovados como
  candidatos, a confirmar contra a pesquisa: reserva de emergência; imposto sobre ações (isenção de R$ 20 mil/mês,
  day trade, declaração no IR); custos (taxa de administração, corretagem, come-cotas); fundos de investimento;
  previdência privada (PGBL/VGBL); debêntures; Tesouro RendA+ e Educa+; COE; análise técnica básica; câmbio e
  dólar; ouro; criptoativos (com foco em risco, regulação CVM/Banco Central e golpes); golpes e fraudes
  financeiras; crédito e dívida (juros do cartão, cheque especial, consignado, renegociação).
- **Escopo:** análise com agentes e pesquisa em fonte primária (Anbima, B3 Educação, CVM, Banco Central, Tesouro
  Direto, Receita) do que um programa de educação financeira e de investidor iniciante no Brasil cobre, comparada
  com as lições existentes. Entrega `.claude/revisao-trilhas-anexos/mapa-cobertura-curriculo.md`: cada tema como
  coberto, raso ou ausente; lições novas propostas com prioridade, posição na trilha (pré-requisitos), widgets
  sugeridos, esforço; e uma coluna **"gancho de funcionalidade futura"** (o que o app poderia oferecer por causa
  do tema, ex.: calculadora de reserva de emergência, simulador de previdência, alerta de golpe), registrada
  como ideia, sem entrar neste backlog.
- **Decisão do autor depois do mapa:** quais lições entram (cada uma vira tarefa RC.4.x no formato de RC.4.1 e
  RC.4.2) e o que fica de fora. Lições novas seguem Princípio 0 (leves), exigem validação RC.1.7 e fatos em RC.1.3.
- **Entregável:** `.claude/revisao-trilhas-anexos/mapa-cobertura-curriculo.md` (34 temas, 21 lições propostas); o autor escolheu 6 (RC.4.4 a RC.4.9).
- **Aceite:** mapa entregue, decisão registrada, tarefas RC.4.x criadas, contagem de lições e spec atualizadas em
  RC.8.2.
- **Depende de:** nada (pode rodar já, em paralelo à Fase 1).

### RC.4.1 · Nova lição "Juros, Selic, CDI e TR" (antes da 0.5) ✅ concluída (2026-10-04)

- Define Selic (meta x efetiva), CDI (taxa entre bancos, ~Selic), TR (o que é, por que existe, hoje ~zero) e o
  papel do IPCA; dá o grafo `0.4 -> nova -> 0.5`. Ver `audit-licoes-0-3.md`.
- **Aceite:** RC.1.2 sem Selic/CDI/TR usados antes; lição passa nos checkpoints; quem estava na 0.5 não é
  bloqueado nem perde progresso.
- **Depende de:** RC.3.1, RC.3.2, RC.3.5, RC.1.3.
- **Entregável (2026-10-04):** *Fatos (RC.1.3), pesquisados em fonte primária antes do texto:* `selic-definicao` (página do Copom do BC lida), `cdi-taxa-di` (glossário da B3, base de 252 dias úteis), `tr-metodologia` (Res. CMN 4.624/2018 lida), `tr-historico-zero` e `selic-cdi-valores-recentes` (séries 226, 432, 1178 e 4389 do SGS do BC consultadas direto na API). *Lição:* `stableKey` `juros-selic-cdi-tr`, `code` `0.5`, `sortOrder` 5, em `db/lessonContentTrilha0b.ts` (`blocks`), 5 cartões de texto curtos, widgets `copom-timeline`, `real-return` e `selic-ipca-chart` (primeiro uso dos três), 5 perguntas (quem define a meta, aposta "Selic sobe, CDB 100% do CDI", 110% do CDI, juro real negativo, "a TR é sempre zero"), bloco "Na plataforma" (8 reuniões x 21 dias simulados). A poupança passou a `code` `0.6` (o `stableKey` `0.5` não muda, então o progresso dela fica); a ordem das 31 lições seguintes subiu uma casa. *Mecanismo de inserção no meio, que não existia:* `insertLessonInMiddle` e `findMiddleInsertions` em `seedLessons.ts` (transação: libera o `code`, renumera `sort_order` por valores negativos por causa da restrição de unicidade, insere, e dá `waived_at` a quem já satisfez 5 lições ou mais); o `main` do seed os chama antes do `upsert`. *Termos:* `selic`, `cdi` e `tr` passam a ter `definedIn: '0.5'` e `ipca` `'0.3'` (que já o define inline) em `termPrerequisites.ts`; glossário com `originLesson`. Baseline do teste de conteúdo só trocou a chave `lesson:0.5` por `lesson:0.6` (nenhuma violação nova). Validou: backend lint/build/`npm test` (2715, com `TEST_DATABASE_URL` num Postgres 16 descartável: o teste `seedLessons.integration.test.ts` semeia o estado antigo, cria 3 usuários com 5, 4 e 0 lições concluídas, roda a inserção e confere que só o de 5 recebe a dispensa, que a linha da poupança mantém o `id` e que rodar de novo não faz nada), frontend `tsc -b`/`vitest` (1378). **Achado que corrige a própria auditoria e o glossário:** a TR **não** é "hoje ~zero". Pela série 226 do BC ela ficou zerada de 2017 a fev/2022 e em out/2026 está em cerca de 0,16% ao mês, porque com a Selic acima de 8,5% ela é positiva. O glossário dizia "hoje próximo de zero" (corrigido). **A RC.5.2 (poupança) precisa levar isso a sério:** com Selic alta a poupança rende 0,5% ao mês **mais** a TR, não 6,17% ao ano. **Ressalvas:** (a) a lição não foi aberta no navegador nem passou por `docker compose` (a pilha do Compose é do checkout principal; a validação foi com Postgres descartável e testes); (b) o bloco `blocks` da lição não tem teste que renderize o player com ela, só o contrato (`seedLessons.test.ts`) e o conteúdo proibido; (c) a Res. 4.624 foi lida só até o art. 5º; o redutor R e o piso zero da TR vieram de resultado de busca da norma anterior, então o texto da lição não cita a fórmula; (d) o `tr-historico-zero` e o `selic-cdi-valores-recentes` são valores datados (vencem em 12 meses); (e) o e2e `lessonJourney` não foi rodado.

### RC.4.2 · Nova lição "B3, corretora e ordens" ✅ concluída (2026-10-05)

- Cobre o que as ações cobram sem ensinar: corretora, B3, ordem a mercado x limite, spread, liquidez, horário,
  lote e fracionário (sufixo F), custos e IR de venda de ações (isenção de R$ 20 mil/mês), posicionada antes da 2.5.
- **Depende de:** RC.3.4e, RC.1.3, D11.
- **Entregável (2026-10-05):** *Fatos (RC.1.3), pesquisados antes do texto:* `b3-ordens-tipos` (glossário da B3, "Ordem a Mercado" e "Ordem Limitada" lidos), `b3-horario-pregao` (tabela de horários da B3 aberta: as fases do pregão, sem citar horário na lição porque ele muda no ano) e `investidor-custos-acoes` (Portal do Investidor da CVM lido: corretagem livre, custódia, emolumentos, liquidação); `b3-ticker-sufixos` (lote de 100 e fracionário) e `acoes-isencao-20-mil` já existiam. *Lição:* `stableKey` `b3-corretora-ordens`, `code` `2.5`, `sortOrder` 23, "Como a ação é negociada: B3, corretora e ordens", em `db/lessonContentTrilha2.ts` (`blocks`): a ordem passa pela corretora até a B3, ordem a mercado e limite definidas inline, aposta "uma compra a mercado de 500 paga exatamente o melhor preço?" (certa fora da posição 0), widget `order-book`, spread (numérica de R$ 0,05), ordem limite que espera na fila, liquidez (V/F), lote e fracionário, fases do pregão sem horário, custos sem número, isenção de R$ 20 mil no mês (R$ 15 mil vendidos não pagam IR), "Na plataforma". 6 perguntas além da aposta. *Renumeração em cadeia da Trilha 2:* 2.5 passou a `code` 2.6, o grupo 2.6.x a 2.7.x, 2.7 a 2.8, 2.8 a 2.9, 2.9 a 2.10, 2.10 a 2.11 (o `stableKey` de cada uma não muda, então o progresso fica), e o `sortOrder` de todas as lições a partir da posição subiu um (a Trilha 3 inclusive); `termPrerequisites.ts` (ordem, spread e liquidez agora definidos na `2.5`) e `originLesson` do glossário seguiram a nova numeração; entradas novas no glossário (`ordem a mercado`, `ordem limite`) e `liquidez` com origem na 2.5. Baseline de conteúdo: mesmas 23 violações, só com a chave renumerada. *Teste de integração do seed* estendido para a terceira inserção (usuário que já concluiu 23 lições recebe a dispensa só dela e das anteriores) e rodado num Postgres 16 descartável (passou). Validou: backend lint/build/`npm test` (2705, mais o de integração), frontend `tsc -b`/`vitest` (1512), `blocks` contra o schema Zod. **Ressalvas:** (a) os textos antigos da Trilha 2 que citam "lição 2.6.5", "lição 2.10" etc. (violações do baseline `numero-de-licao`) agora apontam a numeração anterior, até a RC.5.9 a RC.5.13 reescreverem; (b) `ticker` e `ON/PN` continuam sem lição definidora (`plannedIn` ainda aponta RC.4.2, mas esta lição não os define: o ticker é usado desde a 2.1, e a RC.5.9 os ensina antes de cobrar), então o lint estrito só liga depois dela; (c) o glossário da B3 define "spread" como diferença entre taxas de crédito, então o spread do livro de ofertas é definido pela lição como conceito geral, sem citar a B3; (d) não há número de corretagem, custódia ou emolumento (as tarifas mudam e não foram registradas); (e) o "Na plataforma" diz que a ordem vai direto ao livro, sem corretora, sem conferir no motor quais tipos de ordem a plataforma aceita; (f) a RC.4.3 vai reordenar a trilha e renumerar de novo; (g) sem `docker compose`, e2e nem conferência visual; (h) `/code-review` não rodado.

### RC.4.3 · Reordenação da trilha 2 ✅ concluída (2026-10-05)

- Ordem proposta pelo agente: 2.1, 2.3, 2.2, nova B3/ordens, 2.5, 2.4, 2.6.1, 2.6.2, 2.6.5, 2.6.3, 2.6.4, 2.7, DY
  (2.6.6 depois da 2.7, porque dividendos precedem DY). Mover IPCA antes da 1.3 (ou definir inline).
- **Aceite:** mudar `unlocks`/ordem sem alterar `stableKey`; migração de dados com N.24; e2e de progressão
  percorre a trilha inteira.
- **Depende de:** RC.4.1, RC.4.2, N.24 (já feita).
- **Entregável (2026-10-05):** a Trilha 2 ficou 2.1 ação, ticker, IPO, B3 e ordens, oferta e demanda, notícias, balanço, margens, endividamento, ROE, P/L e P/VP, dividendos, DY, setores, ETFs, FIIs (16 lições). *Códigos novos (o `stableKey` de cada uma não muda):* 2.1, 2.2 (ticker), 2.3 (IPO), 2.4 (B3 e ordens), 2.5 (oferta e demanda), 2.6 (notícias), 2.7.1 a 2.7.5 (balanço, margens, endividamento, ROE, P/L e P/VP), 2.7.6 (dividendos), 2.7.7 (DY, agora depois dos dividendos), 2.8 (setores), 2.9 (ETFs), 2.10 (FIIs). Dividendos entrou no grupo 2.7.x, então setores, ETFs e FIIs voltaram uma casa (2.9, 2.10, 2.11 viraram 2.8, 2.9, 2.10). *Mecanismo novo:* `reorderExistingLessons` em `seedLessons.ts` (transação: toda lição cujo `code` ou `sortOrder` difere do seed vai a valores provisórios, `tmp-` e posição negativa, e depois ao definitivo; `id`, `stableKey` e progresso intactos), chamada no `main` do seed entre as inserções no meio e o `upsert`; idempotente. *Sem dispensa (N.24):* só sobem de posição o ticker e o endividamento, que exigem algo que o usuário já tinha feito ou que segue disponível, e as que descem só adiam o que ele já concluiu, então ninguém é bloqueado nem fica sem acesso. `termPrerequisites.ts` (ON/PN na 2.2, ordens e spread na 2.4, NAV na 2.9, cíclico na 2.8, alavancagem na 2.7.3, ITR e DFP na 2.7.1) e `originLesson` do glossário seguiram a nova numeração; os dois `{{ref:2.3}}` das lições da Trilha 3 viraram `{{ref:2.2}}`. Baseline de conteúdo: mesmas 17 violações, só com a chave renumerada. "IPCA antes da 1.3" já estava resolvido pela RC.4.1. Validou: backend lint/build/`npm test` (2705, mais um teste novo que trava a ordem e os códigos da trilha), frontend `tsc -b`/prettier/`vitest` das lições, e o teste de integração do seed estendido (estado antigo com a Trilha 2 na ordem antiga, depois inserções, reordenação e `upsert`; confere ids, códigos, dispensas só de quem passou e idempotência) rodado num Postgres 16 descartável. **Ressalvas:** (a) não existe e2e de progressão da trilha inteira no repositório, então o item "e2e percorre a trilha inteira" do aceite não foi cumprido; (b) sem `docker compose` nem conferência visual do mapa; (c) o desbloqueio da compra de ações segue na lição do ticker, agora antes de B3 e ordens: decisão aberta em `pontos-em-aberto-decisao-produto.md` (034); (d) os textos antigos da Trilha 2 que citam número de lição seguem apontando a numeração anterior até a RC.5.10 a RC.5.13; (e) o texto da lição de ROE pode citar endividamento como se viesse depois, e a de endividamento passou a vir antes dela (revisar na RC.5.10); (f) `/code-review` não rodado.

### RC.4.4 a RC.4.9 · Lições novas aprovadas (2026-10-03)

Escolhidas pelo autor a partir de `mapa-cobertura-curriculo.md` (propostas N1, N2, N4, N5, N6, N14). **Ficam de fora por
enquanto:** golpes, FGTS, fundos/come-cotas, debêntures, RendA+/Educa+, previdência, aposentadoria, análise técnica,
câmbio, ouro, cripto, COE, Open Finance, ESG e seguros (continuam no mapa como backlog futuro de conteúdo). Cada
tarefa entrega a lição completa: cartões curtos (Princípio 0), widgets, 3 a 7 checkpoints com explicação por
alternativa, fatos em RC.1.3 (fonte primária pesquisada antes de escrever), validação no estilo RC.1.7, seed com
`stableKey` próprio, glossário (RC.3.5) e proteção de quem já está no meio da trilha (N.24). Cada uma tem os detalhes
(cartões-chave, widget, fatos e URLs) na seção correspondente do mapa.

| Tarefa | Lição (proposta) | Posição | Widgets novos | Esforço | Fatos a registrar e reconferir |
|---|---|---|---|---|---|
| RC.4.4 ✅ | **Orçamento**, "Para onde vai seu dinheiro" (N1): renda menos gastos, fixos/variáveis/eventuais, regra de bolso 50/30/20, pague-se primeiro | início da Trilha F ou logo após a 0.1 (D13) | `budget-split` (sliders de categoria, sobra em R$ e %, comparação com 50/30/20) | M | Caderno de Educação Financeira do Banco Central; a 50/30/20 é rotulada como regra de bolso popular se não constar na fonte oficial |
| RC.4.5 ✅ | **Dívida e crédito** (N2): juros compostos contra você, rotativo do cartão, cheque especial, consignado, dívida cara primeiro, renegociação | Trilha F ou Trilha 0 após RC.4.1 (D13) | `debt-snowball` (saldo, taxa a.m., pagamento; meses para quitar e juros totais; efeito do pagamento mínimo), `pay-or-invest` | M | Lei 14.690/2023 (juros do rotativo limitados ao valor original); teto do consignado vigente (exemplo datado); programa de renegociação vigente; taxas médias do Banco Central; dependem de RC.4.1 |
| RC.4.6 ✅ | **Reserva de emergência** (N4): quanto e onde. Cumpre a promessa das lições 1.1 e 1.2, que falam em "montar uma reserva de emergência de verdade" e nenhuma lição ensina | Trilha 1, logo após a 1.2 | `emergency-fund-calculator`, `where-to-keep` (arrastar produto para "serve" ou "não serve") | M | faixas de 3 a 6 meses (CLT) e 6 a 12 (autônomo): só gravar com texto oficial, senão rotular regra de bolso; Tesouro Reserva só se existir e estiver verificado |
| RC.4.7 ✅ | **Imposto em renda variável** (N5): swing 15%, day trade 20%, isenção de R$ 20 mil/mês só para ações, DARF, "dedo-duro", declaração no IR, dividendos | Trilha 2, após a 2.10 | `equity-tax-calculator`, `tax-decision-tree` | M | B3/Receita (alíquotas, isenção, retenção 0,005% e 1%); desfecho da MP 1.303/2025 (caducou) em fonte oficial; Lei 15.270/2025 (10% sobre dividendos acima de R$ 50 mil/mês por fonte pagadora) no Planalto; depende de RC.4.2 |
| RC.4.8 ✅ | **Custos de investir** (N6): corretagem, custódia, taxa de administração, gestão e performance, spread, o efeito de 2% ao ano em 20 anos | Trilha 2, após RC.4.2 e 2.9 | `fee-drag` (duas curvas e a diferença em R$ e %, reaproveita `compound-growth`) | P/M | definições de taxa de administração, gestão e performance (Portal do Investidor/CVM); custódia do Tesouro e corretagem vigentes; depende de RC.3.4c |
| RC.4.9 ✅ | **Vieses e emoção** (N14): aversão à perda, efeito manada, excesso de confiança, regras prévias | Trilha 3, antes do desafio final | `behavior-bias-quiz` (cenários curtos, o viés e o custo simulado, usando uma queda de evento macro do jogo como caso) | M | nenhum número; achar o material de finanças comportamentais do Portal do Investidor antes de citar |

- **Aceite de cada uma:** lição completa e navegável; Princípio 0 respeitado (teste de tamanho verde); RC.1.1 e RC.1.2
  verdes; widget com resumo textual e teste da fórmula; fatos com URL e `verifiedAt` em RC.1.3; progresso de quem já
  passou da posição não é bloqueado nem perdido; e2e da trilha atualizado.
- **Depende de:** RC.1.3, RC.1.7, Fase 3 (widgets), RC.3.5 e D13 (posição); RC.4.5 de RC.4.1; RC.4.7 e RC.4.8 de RC.4.2.
- **Contagem:** 35 atuais + RC.4.1 + RC.4.2 + 6 = **43 lições**.

---

## Fase 5: Reescrita do conteúdo, lição por lição

Para cada lição: remover o que a varredura apontou, aplicar o "Na plataforma" onde diverge, corrigir os erros
factuais, adicionar profundidade, 3 a 7 checkpoints com explicação após o acerto, os widgets da Fase 3 e
revisão de copy pelo guia (RC.1.6). Cada tarefa tem como critério de aceite: RC.1.1 e RC.1.2 verdes, fatos vindos
do módulo RC.1.3, widgets com resumo textual, nenhuma conta externa. Esforço: P/M/G conforme os anexos.

**Regra de entrada de toda tarefa da Fase 5:** (1) ler a seção da lição em `validacao-licoes.md` (RC.1.7);
(2) para qualquer fato novo que a reescrita introduza, pesquisar fonte primária na web e registrá-lo em RC.1.3
**antes** de escrever o texto; (3) escrever leve (Princípio 0): a lista de correções abaixo vira cartões curtos,
widgets e checkpoints, não parágrafos novos; (4) o teste de tamanho de cartão (RC.1.1) precisa passar.

| Tarefa | Lições | Principais correções (resumo; detalhe no anexo) | Esforço |
|---|---|---|---|
| RC.5.1 ✅ | 0.1-0.4 | tirar "TCC cap. 2.1.1" da 0.2; "regime composto" impreciso; "indicador nesta plataforma é nominal" (0.4) vira Na plataforma; IPCA definido ou movido | M |
| RC.5.2 ✅ | 0.6 (poupança; era 0.5 até a RC.4.1) | duas regras (Selic acima de 8,5%: 0,5% a.m. + TR; igual ou abaixo: 70% da Selic + TR), TR explicada, "sempre atrás" falso: comparação líquida; widget `real-return`; **a TR hoje é positiva (cerca de 0,16% ao mês em out/2026, fato `tr-historico-zero`), então a poupança com Selic alta rende 0,5% ao mês mais a TR, perto de 8% ao ano e não 6,17%** | G |
| RC.5.3 ✅ | 1.1, 1.2 | PU do Tesouro Selic sobe todo dia, a Selic muda a velocidade (pergunta corrigida); IOF 29 dias, custódia B3, IR; remover "spec do TCC" | M + G |
| RC.5.4 ✅ | 1.3 (Copom) | 8 reuniões/ano de 2 dias, ~45 dias (nunca "21 dias simulados"); meta de inflação 3% ±1,5; meta x efetiva; Taylor vira Na plataforma; gangorra inflação x Selic; gráfico Selic x IPCA | G |
| RC.5.5 ✅ | 1.4-1.6 | FGC completo (conglomerado, R$ 1 milhão em 4 anos, o que não cobre, sem "tão seguro quanto o Tesouro"); CDI com exemplo coerente (% do CDI); IR com IOF e retenção, isenção só PF; LCI/LCA com carência real e `equivalent-rate`; remover `[revelar]` | G |
| RC.5.6 ✅ | 1.7-1.8 | Prefixado: R$ 199,24 é bruto, LTN x NTN-F, vencimento coerente; marcação a mercado com gangorra e duration, vale também para IPCA+, Copom x taxa de mercado do título; remover "Copom simulado a cada 21 dias reais" e "Sandbox" | M + G |
| RC.5.7 ✅ | 1.9-1.11 | IPCA: cesta e abrangência reais, meta 3% ±1,5, números atuais verificados; IPCA+: marcação a mercado, IR sobre o ganho nominal, VNA e defasagem, taxa realista; CRI/CRA: não vendê-los como reserva de emergência, risco nos devedores e garantias (patrimônio separado), FGC não cobre, isenção e risco regulatório | M-G + G + G |
| RC.5.8 ✅ | 3.1-3.4 | trilha 3 vira planejamento real: diversificação, perfil de investidor real (conservador/moderado/arrojado, questionário de suitability; "Sofisticado" removido), comparação de produtos líquida (252 dias úteis, CDI explícito), desafio final; prática no simulador como etapa separada e rotulada; 3.4 sem "evento real" para evento simulado (D12) | G x4 |
| RC.5.9 ✅ | 2.1-2.5 | IPO com oferta secundária, follow-on e bookbuilding; ticker/ON/PN/sufixos (5 a 8, BDR 32-35, F) ensinados antes de cobrados; notícias e oferta e demanda sem "motor/feed/painel"; livro de ofertas interativo | G |
| RC.5.10 ✅ | 2.6.1-2.6.6 | PL é valor contábil; EBIT x lucro líquido; ROE com alavancagem e DuPont; endividamento: Dívida Líquida/EBIT não se aplica a banco (a lição afirma o contrário); a promessa do "painel ao vivo" dos 6 números base precisa de painel real ou sai do texto; DY com imposto de 2026; "9 indicadores do currículo" fora | G |
| RC.5.11 ✅ | 2.7 | data com x data ex x pagamento corretas (hoje troca data ex por data com); periodicidade real, JCP (15% na fonte), payout mínimo de 25%, Lei 15.270/2025; ações e FIIs não são iguais; "14 dias simulados" removido (o motor usa 91); Na plataforma explicando o calendário | G |
| RC.5.12 ✅ | 2.8, 2.9 | setores: cíclico/defensivo/alavancado definidos; gabarito do banco com Selic alta não segue a regra interna do motor (bancos tendem a ganhar com spread); ETF: maioria reinveste, IR 15% sem a isenção de R$ 20 mil, NAV/ágio/participante autorizado preparados, "deságio" sem colidir com o glossário, peso do banco no SINT11 coerente com o seed (35% x 20%) | M-G + G |
| RC.5.13 ✅ | 2.10 | FII: distribuição mensal (mínimo 95% do resultado semestral), isenção de IR para PF (requisitos), 20% sobre ganho de capital, P/VP, papel indexado a IPCA, "dividendo" x "rendimento", frase quebrada na revelação e `unlocksDescription` com erro ("com onde crescer") | G |
| RC.5.14 | Todas | taxas citadas (CDB 12%, LCI 9,5%, LTN 11,75%, NTN-B 6%) alinhadas ao catálogo (% do CDI e spreads) ou apresentadas como exemplo didático explícito | M |

- **RC.4.9 entregue (2026-10-06):** lição nova "Cabeça de investidor" (`stableKey` `vieses-e-emocao`, `code` 3.4, `sortOrder` 40) inserida antes do desafio final, que passou a `code` 3.5 (mesmo `stableKey` 3.4, `sortOrder` 41); a Trilha F foi para 42 e 43. Conteúdo em `BLOCKS_VIESES` (`backend/src/db/lessonContentTrilha3.ts`). *Fato (RC.1.3), aberto antes do texto:* `cvm-vieses-comportamentais` (Série CVM Comportamental, volume 1 "Vieses do Investidor", PDF lido: aversão à perda, ancoragem no preço de compra, autoconfiança excessiva e as recomendações de estratégia com limites, reavaliar como se fosse caixa e desconfiar de pressa). Aposta (aversão à perda), 4 checkpoints, widget `behavior-bias-quiz` (4 situações com 3 reações; nomeia o viés ou diz que seguiu o plano; conta quantas vezes seguiu; dados em `features/lessons/widgets/biasMath` com teste), regra prévia e bloco "Na plataforma". Glossário: `aversão à perda`, `ancoragem`, `autoconfiança excessiva`. Registrado nos dois lados do contrato e em `.docs/backend/lessons.md`. Testes do seed atualizados (ordem da Trilha 3 e o caso de inserção no meio, `seedLessons.integration.test.ts`). Validou: backend lint/build/`npm test` (2740), frontend `tsc -b`/oxlint/`vitest` (1686). **Ressalvas:** (a) o efeito manada pedido no desenho ficou de fora: a página da CVM sobre ele não abriu (só a do volume 1, que não o traz), então não entra texto sem fonte; (b) o custo "simulado" do desenho virou explicação textual por reação, sem número; (c) o teste de integração de inserção no meio da trilha (precisa de `TEST_DATABASE_URL`) foi atualizado mas não rodado; (d) sem conferência visual nos 3 breakpoints nem `docker compose`; `/code-review` não rodado.
- **RC.5.8 entregue (2026-10-06):** lições 3.1 a 3.4 reescritas como planejamento (D12) em `blocks` (`BLOCKS_3_1` a `BLOCKS_3_4` em `backend/src/db/lessonContentTrilha3.ts`, ligadas em `seedLessons.ts`; `stableKey` e `sortOrder` preservados, então o progresso de quem já está na trilha não muda). *Fato novo (RC.1.3), aberto antes do texto:* `suitability-cvm30` (Guia de Suitability do Portal do Investidor, CVM: o perfil é do investidor, vem de questionário sobre objetivos, situação financeira e conhecimento, e os nomes das categorias ficam com cada instituição; a lição não cita número de artigo nem de perguntas). Demais fatos já registrados (`fgc-limite-por-cpf`, `ir-renda-fixa-regressivo`, `lci-lca-prazo-minimo`). *3.1:* aposta de peso x queda (20% x 50% = 10%), risco específico x de mercado, cinco bancos não é diversificar, FGC por emissor com `fgc-coverage-bar` e `allocation-donut`. *3.2:* prazo e perfil do investidor, suitability, `risk-profile-quiz`, `risk-return-scatter`, "mais risco não garante mais retorno", `rating-ruler`; "Sofisticado" sai do texto de aprendizado e fica só como rótulo do ativo no bloco "Na plataforma". *3.3:* CDB x LCI em 180 dias com `product-comparator` e `equivalent-rate` (CDI de 10% como exemplo declarado, 22,5% "até" 180 dias, prazo mínimo de 6 meses, FGC); o tipo `fixed_income_comparison` e o botão "Ver resultado" saem da lição. *3.4:* alta de Selic e marcação a mercado (`mtm-seesaw`), Tesouro Selic protege de juros, não de qualquer inflação, diversificação sem proteção perfeita, `allocation-donut`, e a prática no Mercado como bloco "Na plataforma" separado; sem "evento real" (`unlocksDescription` corrigido) e sem a regra "BNDD4 sente mais". 16 checkpoints no total. Glossário: `risco específico`, `risco de mercado`, `perfil do investidor`. Baseline de conteúdo encolheu 7 violações (regravado). Validou: backend lint/build/`npm test` (2739), frontend `tsc -b` e `vitest` das lições. **Ressalvas:** (a) sem conferência visual nos 3 breakpoints nem `docker compose`; `/code-review` não rodado; (b) o exemplo real de escândalo (Americanas) ficou de fora por falta de fonte primária aberta; (c) sem simulador de teste de estresse por cenário: o `allocation-donut` cobre o "ano ruim"; (d) a RC.4.9 (vieses) ainda falta para fechar o P12.
- **RC.5.11 e RC.5.13 entregues (2026-10-06, na mesma sessão porque as duas lições dividem widgets, fatos e arquivo):** lições `stableKey` 2.7 (`code` 2.7.6, "Dividendos, JCP e data ex") e 2.10 (FIIs) reescritas em `blocks` (`BLOCKS_2_7_6` e `BLOCKS_2_10` em `backend/src/db/lessonContentTrilha2Proventos.ts`, ligadas em `seedLessons.ts`). *Fatos (RC.1.3), abertos antes do texto:* `b3-data-com-ex` (glossário da B3 lido: data com é o último dia com direito, a data ex vem no dia seguinte, vale para ações e cotas de FII), `jcp-definicao` e `fii-ganho-capital` (os dois como trecho de busca: a página do Planalto não abriu, o texto foi lido em reprodução do artigo; por isso a lição **não cita** os 20% do ganho de capital de FII, só diz que é tributado e que a isenção de R$ 20 mil vale só para ações). *2.7.6:* dividendo, payout (metade do lucro se o estatuto for omisso, fato `dividendo-obrigatorio`), aposta "compro na data ex, recebo?" (certa: não), widget `dividend-timeline`, o preço cai o valor do provento na data ex, JCP e proventos, retenção de 2026 (dividendo só acima de R$ 50 mil no mês, JCP 17,5%), `dividend-net-calculator`, frequência por empresa, 6 perguntas e "Na plataforma" (frequência por empresa, metade do lucro, dias úteis, sem retenção e sem JCP). Sai o "14 dias simulados", a data ex trocada pela data com, e a frase de que vale igual para ações e FIIs. *2.10:* tijolo e papel (CRI), aposta da vacância no FII de papel, rendimento no lugar de dividendo, distribuição mínima de 95% com pagamento mensal como prática de mercado, `fii-monthly-calendar`, Dividend Yield de 12%, P/VP, isenção do rendimento nas condições da lei, ganho tributado sem a isenção de R$ 20 mil, Selic alta e preço de FII, 6 perguntas e "Na plataforma" (pagamento mensal com dia útil de 5º a 15º por fundo). Sai o "com onde crescer" do `unlocksDescription` e a frase quebrada da revelação. Glossário: `proventos`. Baseline de conteúdo encolheu 7 violações (regravado). Validou: backend lint/build/`npm test` (2725), frontend `vitest` das lições. **Ressalvas:** (a) o texto de "Na plataforma" descreve o motor do P9 (frequência por política, dias úteis, FII mensal real), então vale o que está na `rc-p9-calendario-proventos`; (b) tipos de FII além de tijolo e papel (FoF, híbrido, Fiagro) e a vacância financeira ficaram fora para não pesar a lição; (c) o ganho de capital de FII com alíquota segue para a RC.4.7, depois de abrir o texto da lei; (d) sem conferência visual no app nem `docker compose`; `/code-review` não rodado.
- **RC.5.10 entregue (2026-10-05):** lições `stableKey` 2.6.1, 2.6.2, 2.6.5, 2.6.3, 2.6.4 e 2.6.6 (`code` 2.7.1, 2.7.2, 2.7.3, 2.7.4, 2.7.5 e 2.7.7) reescritas em `blocks` (`BLOCKS_2_7_1` a `BLOCKS_2_7_5` e `BLOCKS_2_7_7` em `backend/src/db/lessonContentTrilha2Empresa.ts`, ligadas em `seedLessons.ts`, texto legado por `legacyText`; `microDecisionType` passou a `reflection`). *2.7.1 balanço:* ITR/DFP definidos inline, seis números em três cartões, aposta "o patrimônio líquido é o que a empresa vale na bolsa?" (certa: valor contábil), `interactive-balance`, EBIT x lucro líquido com "em geral", conta de PL, caixa não é PL, "Na plataforma". *2.7.2 margens:* aposta A (R$ 1 bi, lucro R$ 50 mi) x B (R$ 200 mi, R$ 40 mi), `margin-comparator`, margem EBIT numérica, por que a líquida é menor, margem só compara dentro do setor, ganho pontual infla a margem; a pergunta repetida da 2.7.1 saiu. *2.7.3 endividamento:* dívida líquida e {{alavancagem}} definidas, `debt-thermometer` (com o choque de Selic), conta de 2 anos de EBIT, "é aproximação", Selic sobe e a dívida atrelada ao CDI encarece primeiro, e a frase errada sobre BNDD4 saiu: banco captar é o negócio, então o indicador costuma não se aplicar. *2.7.4 ROE:* aposta A (PL de R$ 500 mi) x B (R$ 1 bi) com o mesmo lucro, `roe-lab` (DuPont), conta de 15%, ROE sobe com dívida e o risco junto, ROE não compara banco com mineradora. *2.7.5 P/L e P/VP:* LPA e VPA definidos antes, aposta do preço que triplica, `multiples-calculator`, P/L de 12, P/L baixo não é sinônimo de barato, prejuízo sem sentido, P/VP abaixo de 1, e `live-indicator` de VALR3 no fim. *2.7.7 DY:* aposta do preço que dobra, conta de 6%, DY alto por queda de preço, dividendo passado não garante o próximo, imposto 2026 (10% acima de R$ 50 mil/mês por mesma empresa e pessoa; JCP 17,5%) pelos fatos `dividendos-retencao-lei-15270` e `jcp-aliquota`, `live-indicator`. A promessa do "painel ao vivo dos seis números" saiu do texto: o painel de 9 indicadores (T10) só aparece, como widget, onde faz sentido (P/L e DY), e a legenda não promete seis. "9 indicadores do currículo", "spec 3.2.2", "motor" e número de lição saíram. Glossário: `receita líquida`, `lucro líquido`, `patrimônio líquido`, `margem`, `dívida líquida`, `LPA` e `VPA` novos; origem do `EBIT` na 2.7.1. Baseline de conteúdo encolheu 2 (2.7.1 sem violação). Validou: backend lint/build/`npm test` (2711), frontend `vitest` das lições (227) e prettier do glossário, `blocks` contra o schema Zod (teste do seed). **Ressalvas:** (a) os cartões e as perguntas dos 6 conteúdos foram escritos sem fonte nova: os conceitos (margem, ROE, P/L, P/VP, dívida líquida) são de mercado em geral, e a afirmação de que dívida líquida sobre EBIT costuma não valer para banco não tem fonte primária aberta (por isso diz "costuma"); (b) o prazo de ITR e DFP não é citado, porque `cvm-itr-dfp-prazos` segue como trecho de busca; (c) a 2.7.6 ainda diz "o Dividend Yield da lição anterior" (agora é a posterior) e tem violações de baseline: é a RC.5.11; (d) o imposto sobre o lucro do widget de balanço segue como controle livre, sem afirmar alíquota; (e) sem `docker compose`, e2e nem conferência visual dos 3 breakpoints, e o teste de integração do seed não rodou (sem lição inserida, só reescrita); (f) `/code-review` não rodado.

- **RC.3.4h entregue (2026-10-06):** três widgets registrados nos dois lados do contrato (props todas com default): `risk-return-scatter` (`highlight`, `profile`: dispersão SVG de oscilação x retorno esperado de seis investimentos; com um perfil escolhido, a região adequada é tracejada, círculo cheio dentro e vazado fora, e a tabela de leitura repete os valores; botões por investimento), `allocation-donut` (`profile`, `amount`: rosca em SVG com quatro classes, parte de um exemplo por perfil, quatro controles de peso em passos de 5, soma e aviso quando não fecha em 100%, perda de um "ano ruim" ilustrativo em % e em R$ e contribuição por classe na conta) e `risk-profile-quiz` (sem props: 6 perguntas, pontos de 1 a 3, até 40% conservador, até 70% moderado, acima arrojado; precisar do dinheiro em menos de 1 ano limita ao conservador e não ter reserva limita o arrojado ao moderado, com a explicação "a capacidade de risco pesa mais que a vontade"; botão Refazer). Contas e dados em `features/lessons/widgets/riskMath` com teste table-driven. **Todos os números de volatilidade, retorno, quedas e alocações são ilustrativos e os widgets dizem isso na tela**; nenhuma fonte regulatória nova (o questionário diz que a corretora aplica o próprio, sem citar norma: a RC.5.8 registra o fato da API/Resolução CVM 30 antes de citá-la). Não incluídos do desenho original: heatmap de correlação e simulador de "pior ano" por horizonte (o ano ruim do donut cobre a ideia). **Ressalvas:** (a) nenhuma lição usa os widgets ainda (a RC.5.8 reescreve a 3.1 e a 3.2 com eles); (b) sem conferência visual nos 3 breakpoints nem `docker compose`. Validou: frontend `tsc -b`/oxlint/`vitest` (1679), backend lint/build/`npm test` (2739).

- **RC.4.5 entregue (2026-10-06):** segunda lição da Trilha F (paralela): `stableKey` `divida-os-juros-do-outro-lado`, `code` `F.2`, `sortOrder` 42, "Dívida: os juros do outro lado" (`BLOCKS_DIVIDA` em `lessonContentTrilhaF.ts`). Como a trilha pode ser aberta antes de qualquer outra, a lição define juros compostos e taxa ao mês x ao ano no próprio texto (D13 trocou a dependência da RC.4.1 por definição inline; nenhum termo vem de lição anterior). Conteúdo: juros compostos contra você, 8% ao mês são cerca de 152% ao ano, aposta "R$ 1.000 no cheque especial a 8% ao mês por 12 meses" (certa: perto de R$ 2.520), widget `debt-snowball`, rotativo (média do BC perto de 15% ao mês em 2026; limite legal de juros e encargos igual ao valor original da dívida), cheque especial (perto de 7% ao mês), consignado mais barato porque o desconto é em folha, widget `pay-or-invest` ("dívida cara primeiro"), renegociação sem citar programa, "pagar só o mínimo não resolve", "Na plataforma" (não há dívida nem crédito). 6 perguntas além da aposta. *Widgets* (contas puras em `features/lessons/widgets/debtMath`, com testes): `debt-snowball` (saldo, juros ao mês, pagamento: meses para quitar, juros totais, curva do saldo; avisa quando o pagamento não cobre os juros) e `pay-or-invest` (dívida levada ao ano contra rendimento líquido de IR, valores em 12 meses, veredito), registrados nos dois lados do contrato. *Fatos (RC.1.3):* `rotativo-limite-lei-14690` (texto da lei lido, art. 28 §§ 1º e 2º) e `bcb-taxas-medias-credito-pf` (séries SGS 25477 rotativo 15,18% e 25463 cheque especial 7,43% a.m. em ago/2026, lidas na API do BC). Glossário: rotativo, cheque especial, consignado. **Ressalvas:** (a) o teto do consignado do INSS **não** foi citado: os resultados de busca divergem (1,80% em 2025, depois reduções e 1,84%), por isso a lição só explica o porquê da taxa menor; (b) nenhum programa de renegociação (Desenrola) foi citado, pois não se confirmou se está ativo; (c) a vigência de jan/2024 do teto de 100% veio de páginas do governo vistas na busca, não lidas por inteiro; (d) a série 25477 foi identificada como rotativo pelo título da página de dados abertos; (e) o "pagamento mínimo" do cartão não tem valor no widget (varia por emissor): o aluno ajusta o pagamento. Sem `docker compose up`. Backend: lint, build e testes verdes; frontend: tsc e testes verdes. **P11 fechado** (RC.4.4 e RC.4.5): PR por abrir.

- **RC.4.4 entregue (2026-10-06):** primeira lição da **Trilha F "Finanças do dia a dia"** (`trackNumber` 4, paralela, D13): `stableKey` `orcamento-para-onde-vai`, `code` `F.1`, `sortOrder` 41, "Para onde vai seu dinheiro" (`BLOCKS_ORCAMENTO` em `backend/src/db/lessonContentTrilhaF.ts`): investir começa na sobra, aposta "R$ 4.000 de renda e R$ 3.400 de gastos: quanto sobra?" (certa: R$ 600), widget `budget-split`, despesas fixas/variáveis/sazonais, sobra em % (numérica 15%), 50/30/20 rotulada **regra de bolso popular** (não está no Caderno do BC: confirmado por busca no texto), "pague-se primeiro", "Na plataforma". 5 perguntas além da aposta. *Infraestrutura de trilha paralela (a tarefa é a primeira da trilha):* `PARALLEL_TRACK_NUMBERS = [4]` e `isParallelTrack` em `domain/lesson.ts`; `buildProgression` deixa as lições paralelas sempre desbloqueadas e fora de `satisfiedCount`; `unlockedKeysFor` e o espelho do frontend (`unlockedKeysFor`, `nextUnlockFor`) as ignoram; `insertLessonInMiddle` não conta progresso da F na dispensa; o lint de termos trata lição paralela como sem lição anterior (nenhum termo vem "de graça"). **Bug corrigido no caminho:** `answerCheckpoint` e `answerMicroDecision` comparavam `sortOrder` cru com a contagem de concluídas (quebraria com dispensa e com a F); agora usam `buildProgression`, igual a `advanceLesson`. *Frontend:* `TRACKS` ganha a trilha 4 (ticker `TRLHF`, token `--color-track-f` teal nos dois temas, contraste 9,54:1 e 5,47:1, documentado em `identidade-visual-tokens.md`), card do Hub com a dica "Trilha paralela: abra em qualquer ordem"; o mapa e o hub já agrupam por `trackNumber`, então a trilha aparece sem tela nova. *Widget `budget-split`* (`income` e 6 categorias, conta em `features/lessons/widgets/budgetMath` com testes): sobra em R$ e %, aviso de gasto acima da renda, comparação com 50/30/20. *Fato (RC.1.3):* `orcamento-bcb-caderno` (Caderno de Educação Financeira do BC, lido: despesas fixas, variáveis e sazonais, superávit, "pague-se primeiro"). Glossário: orçamento. **Ressalvas:** (a) mapa e hub não foram conferidos visualmente nos 3 breakpoints (a trilha reaproveita os componentes existentes); (b) a F não tem conquista própria nem entra em "todas as 35 lições" (`seedAchievements`), que segue contando só a corrente; reavaliar na RC.8.2; (c) sem `docker compose up` e sem teste de seed com banco real para a F. Backend: lint, build e testes verdes; frontend: tsc, oxlint e testes verdes.

- **RC.4.7 entregue (2026-10-06):** lição nova `stableKey` `imposto-renda-variavel`, `code` 2.12, `sortOrder` 36, "Imposto em renda variável", no fim da Trilha 2 (depois de "O que custa investir", para nenhuma lição existente mudar de código; a Trilha 3 subiu mais uma posição, 3.1 a 3.4 viraram `sortOrder` 37 a 40, `stableKey` iguais). Conteúdo em `BLOCKS_IMPOSTO` (`lessonContentTrilha2Empresa.ts`): swing trade 15% x day trade 20%, aposta "R$ 15 mil vendidos e R$ 2 mil de lucro: quanto de imposto?" (certa: nada, isenção), widget `equity-tax-calculator`, isenção só para ações (ETF e FII pagam), acima de R$ 20 mil todo o lucro é tributado (numérica R$ 600), DARF até o último dia útil do mês seguinte, compensação de prejuízo só do mesmo tipo (numérica R$ 3.000 de base), dedo-duro, `tax-decision-tree`, declaração mesmo com ganho isento, dividendos com retenção de 10% só acima de R$ 50 mil/mês por empresa, "Na plataforma" (o motor não cobra imposto sobre renda variável). 6 perguntas além da aposta. *Widgets:* `equity-tax-calculator` (`kind`, `assetClass`, `salesMonth`, `profit`, `lossCarry`: imposto, DARF abatido do dedo-duro, prejuízo que sobra) e `tax-decision-tree` (3 perguntas; a do valor só aparece para ação vendida em outro dia), conta pura em `features/lessons/widgets/equityTaxMath` com testes, registrados nos dois lados do contrato. *Fatos (RC.1.3):* `renda-variavel-aliquotas` (matéria do Bora Investir da B3 lida: 15%, 20%, dedo-duro 0,005% e 1%, DARF, multa, compensação, declaração) e `mp-1303-caducou` (só registro, a lição não cita a MP; trecho de busca). Glossário: swing trade, day trade, DARF, dedo-duro. **Ressalvas:** (a) o código do DARF e o DARF mínimo não foram conferidos, a lição não os cita; (b) a alíquota de 20% do ganho de FII continua trecho de busca (`fii-ganho-capital`), usada só no widget como valor de exemplo; (c) a página da Receita fala em vendas "de cada ativo" na isenção, a B3 em total de vendas de ações no mês: a lição segue a B3 e fica a reconferir no texto da lei; (d) seed no meio da trilha testado só em unidade (o teste com banco real foi atualizado, mas pulado sem `TEST_DATABASE_URL`), e a validação via `docker compose up` não foi feita. Backend: lint, build e testes verdes; frontend: tsc e testes verdes.

- **RC.4.8 entregue (2026-10-05):** lição nova `stableKey` `custos-de-investir`, `code` 2.11, `sortOrder` 35, "O que custa investir", no **fim** da Trilha 2 (depois dos FIIs, e não logo após os ETFs: assim nenhuma lição existente muda de código e o desbloqueio do FII não atrasa; a Trilha 3 subiu uma posição, 3.1 a 3.4 viraram `sortOrder` 36 a 39, `stableKey` iguais). Conteúdo em `BLOCKS_CUSTOS` (`lessonContentTrilha2Empresa.ts`): custos de ações, taxa de administração que não aparece como débito, aposta "10% bruto, A sem taxa e B com 2% em 20 anos: o B termina com quanto do A?" (certa: perto de 70%), widget `fee-drag`, retorno líquido, as três taxas de fundo, spread, custódia do Tesouro de 0,20% (R$ 40 sobre R$ 20 mil), "corretagem zero não é custo zero", "Na plataforma". 6 perguntas além da aposta. *Widget `fee-drag`* (`initial`, `monthly`, `grossReturnPct`, `feeAPct`, `feeBPct`, `years`): conta pura em `features/lessons/widgets/feeDragMath` (retorno líquido = bruto menos taxa, taxa mensal equivalente, aporte no fim do mês; table-driven), componente `FeeDragWidget` com duas curvas (sólida e tracejada, legenda escrita), diferença em R$, em % do saldo e em fatia do ganho consumida, `aria-live`, resumo textual, registrado nos dois lados do contrato (`widgetPropsSchemas`, `WIDGET_IDS`, Zod do backend e tipo de domínio), `.docs/backend/lessons.md`. Não reaproveita o `GrowthChart` (que é de uma série só); reaproveita só o desenho de controles. *Fato novo (RC.1.3):* `fundos-taxas-definicoes` (administração, gestão e performance, página do Portal do Investidor lida); `tesouro-custodia-b3` (0,20%) e `investidor-custos-acoes` já existiam. Teste de integração do seed estendido (quarta inserção, ninguém dispensado) e rodado num Postgres 16 descartável (passou). Validou: backend lint/build/`npm test` (2713), frontend `tsc -b`/`vitest` (241 nas lições e no widget)/prettier. **Ressalvas:** (a) o exemplo usa taxa 0% no produto A e 10% de retorno bruto, didáticos e rotulados "antes das taxas"; (b) não há número de corretagem nem de emolumento (mudam e não foram registrados); (c) o "Na plataforma" diz que as ordens não pagam corretagem nem custódia, conferido só por não haver corretagem no motor (a taxa de administração do ETF existe, tarefa R.9); (d) taxa de ingresso e saída de fundos ficou de fora, a página da CVM não as define; (e) a lição de fundos com come-cotas (N7) segue fora do escopo; (f) sem `docker compose`, e2e nem conferência visual dos 3 breakpoints; (g) `/code-review` não rodado.

- **RC.5.12 entregue (2026-10-05):** lições `stableKey` 2.8 (setores) e 2.9 (ETFs) reescritas em `blocks` (`BLOCKS_2_8` e `BLOCKS_2_9` em `lessonContentTrilha2Empresa.ts`). *Setores:* cíclico e defensivo definidos inline (glossário novo), juro alto pesa mais em quem tem dívida e lucro no futuro, aposta VALR3 x TNVA3 (certa: TNVA3, coerente com a sensibilidade do motor: mineração 0,02, tecnologia 0,07), 3 perguntas, "Na plataforma" dizendo que a sensibilidade por setor é regra da plataforma calibrada em empresas reais. Sai o "mesmo perfil da Trilha 1", o Conservador/Sofisticado e a aposta do banco (que contrariava a lógica de spread). *ETFs:* cesta de exemplo A/B/C/D (40/20/25/15), sem os pesos do catálogo no texto (o erro de 35% x 20% do banco some), aposta peso x queda (8%), NAV, ágio e desconto (sem "deságio", que não colide mais com o glossário de prefixado; `ágio` com origem 2.9), participante autorizado (glossário novo), "pode reinvestir ou distribuir", taxa de administração sem número, sem isenção de R$ 20 mil (fato `acoes-isencao-20-mil`), "Na plataforma". `unlocksDescription` sem "real". Baseline encolheu 1. Validou: backend lint/build/`npm test` (2711), frontend `vitest` das lições e prettier. **Ressalvas:** (a) não cita a alíquota de 15% do ETF: `etf-ir` segue como trecho de busca e as três fontes oficiais tentadas (Diário Oficial, Receita) não abriram; (b) não há widget de ETF (`etf-shock-simulator` é da RC.3.4g/P10), a conta peso x queda é pergunta numérica; (c) "banco pode ganhar com spread" ficou de fora, sem fonte; (d) o motor não foi relido para confirmar que o `Participante Autorizado` automático cobre tudo o que o "Na plataforma" diz; (e) sem `docker compose`, e2e nem conferência visual; (f) `/code-review` não rodado.

- **RC.5.9 entregue (2026-10-05):** lições `stableKey` 2.1, 2.2, 2.3, 2.4 e 2.5 (esta com `code` 2.6 desde a RC.4.2) reescritas em `blocks` (`BLOCKS_2_1` a `BLOCKS_2_5` em `backend/src/db/lessonContentTrilha2.ts`, ligadas em `seedLessons.ts`, textos legados por `legacyText`). *2.1 ação:* sócio e não credor, aposta "1% do lucro de R$ 1 milhão é seu?" (certa: só se a empresa distribuir, fora da posição 0), `ownership-calculator`, fatia e valor de mercado, duas fontes de ganho, responsabilidade limitada, "Na plataforma". *2.2 IPO:* oferta primária, secundária e mista, aposta sobre o destino do dinheiro, `bookbuilding-simulator`, caixa de R$ 200 milhões (numérica), mercado primário x secundário, follow-on. *2.3 ticker:* a regra (3 ON, 4 PN, 11, F, BDR 32 a 35) vem **antes** da pergunta (a antiga pedia para adivinhar), `ticker-decoder`, "ticker diferente não é empresa diferente", PN sem afirmar que nunca vota. *2.4 notícias:* macro x setorial, aposta do lucro de R$ 1,00 contra R$ 1,20 esperado (o preço embute expectativas, só a surpresa move), `headline-triage`, fonte oficial. *2.5 oferta e demanda:* o preço é o último negócio, aposta de mais compra que venda, `order-book` com as ondas de compradores e vendedores, preço não é valor (ponte para os indicadores); o que a lição B3/ordens já ensina (spread, liquidez, tipos de ordem) não se repete. Saíram "motor de pareamento", "feed", "painel de notícias", "desta plataforma", número de lição e "unit". *Fatos novos (RC.1.3), fonte aberta antes do texto:* `acao-responsabilidade-limitada` (Lei 6.404, art. 1º, Planalto), `b3-ipo-ofertas` (glossário B3: IPO, oferta primária, oferta secundária, mercado primário, bookbuilding) e `b3-ticker-estrutura` (matéria da B3 Educação aberta: 3, 4, 11 e BDR; **não** menciona unit, classes 5 a 8 nem o F, que seguem em `b3-ticker-sufixos` como trecho de busca, então a lição não cita unit nem 5 a 8). Glossário: `ação ordinária`, `ação preferencial`, `oferta primária`, `oferta secundária`, `bookbuilding`, `mercado primário`, `mercado secundário` novos, `IPO` unificado, `ticker` com origem 2.1, `ON e PN` com origem 2.3. **Lint de termos agora é estrito (RC.1.2):** `ticker` definido na 2.1 e `ON e PN` na 2.3; `valor de mercado` na 2.1 (e o padrão passou a só pegar o valor de mercado da empresa, porque as lições 1.x usam a expressão para o preço de recompra de um título); `liquidez` passou a ser definida na reserva de emergência (1.3) e a 1.2 ganhou o `{{liquidez}}` inline; `STRICT = true` em `termPrerequisites.test.ts` sem nenhum aviso restante. Baseline de conteúdo encolheu 6 (2.2, 2.3, 2.4 e 2.5 sem violação). Unlock da 2.3 e da 2.4 mantidos, só com a descrição sem "real" e sem "painel/feed". Validou: backend lint/build/`npm test` (2705), frontend `tsc -b`/oxlint/`vitest` (1512), `blocks` das cinco lições contra o schema Zod (teste do seed). **Ressalvas:** (a) sem `docker compose`, e2e nem conferência visual dos 3 breakpoints, e o teste de integração do seed não rodou (não houve inserção nova); (b) o bloco "Na plataforma" da 2.2 diz que as empresas já nascem listadas e o da 2.5 que as ordens vêm de usuários e robôs de liquidez, sem reconferir o motor linha a linha (robôs existem em `engine/internal/domain/bot`); (c) lock-up, roadshow e a norma da CVM sobre ofertas ficaram de fora por falta de fonte aberta; (d) a 2.1 não compara com a renda fixa em números nem cita IR de ação (já é da lição de B3/ordens e da RC.4.7); (e) o "preço embute expectativas" é conceito geral de mercado, sem fato registrado; (f) as manchetes do `headline-triage` e os tickers do `ticker-decoder` são os da RC.3.4e, sem mudança; (g) a RC.4.3 (reordenação da Trilha 2) ainda vai renumerar e deve mover o ticker (2.3) antes do IPO (2.2), que hoje o usa só depois de defini-lo na 2.1; (h) `/code-review` não rodado.

- **RC.5.7 entregue (2026-10-05):** lições `stableKey` 1.9 (code 1.10, IPCA), 1.10 (code 1.11, Tesouro IPCA+) e 1.11 (code 1.12, CRI e CRA) reescritas em `blocks` (`BLOCKS_1_9`, `BLOCKS_1_10`, `BLOCKS_1_11` em `lessonContentTrilha1b.ts`). *IPCA:* IBGE e abrangência urbana de 1 a 40 salários, aposta "1% e 1% acumulam mais de 2%", acumulado composto (numérica 0,5% ao mês dá 6,17%), meta de 3% com tolerância de 1,5 e IPCA hipotético de 4,8% fora do teto, `real-return` e pergunta do salário contra o IPCA, "Na plataforma" (IPCA simulado sem memória); sem número de inflação do dia e sem o "referência que o BC usa para decidir a Selic" (que a meta é do IPCA, e a decisão olha mais coisas). `microDecisionType` passou de `live_macro_indicator` para `reflection`. *Tesouro IPCA+:* IPCA+ como correção do VNA mais taxa fixa, aposta "aumenta" (certa fora da posição 0), composição `(1+IPCA)(1+taxa)` (11,3% e não 11%), `ipca-plus-simulator`, numérica de R$ 12.152,86, IR sobre todo o ganho nominal, taxa real só garantida no vencimento (V/F sobre risco de preço), `breakeven-inflation` e pergunta de inflação de equilíbrio (13% contra 7% dá cerca de 5,6%), "Na plataforma"; **a regra do VNA em deflação não é afirmada** (sem fonte). *CRI e CRA:* recebíveis e securitizadora, "quem deve é o devedor", sem FGC, patrimônio separado e agente fiduciário (V/F "securitizadora quebra"), `rating-ruler` e pergunta de grau especulativo, isenção só para pessoa física e taxa bruta equivalente com `equivalent-rate` (11% isento a 15% de IR dá 12,94%), vencimento longo e pouca liquidez, **não serve de reserva de emergência** (pergunta própria; o desbloqueio deixou de prometer "reserva com todas as opções"), "Na plataforma". Também entrou o `fgc-coverage-bar` na lição 1.4 do FGC (ressalva (b) da RC.5.5). *Fato novo* `securitizacao-patrimonio-separado` (Lei 14.430/2022, arts. 25 a 27, texto aberto e lido no Planalto). Baseline de conteúdo encolheu 10. Validou: backend lint/build/`npm test` (2702), frontend `vitest` (1472), `blocks` das quatro lições contra o schema Zod. **Ressalvas:** (a) a escala de rating (AAA a D, corte entre BBB e BB) é convenção das agências e não tem fato oficial; a lição diz "agências de classificação de risco" e o bloco "Na plataforma" fala em escalas próprias; (b) VNA e o "entre os dias 10 e 15" seguem `trecho-de-busca` (`tesouro-vna-ipca`) e `ipca-abrangencia` também; a lição só cita o início do VNA em R$ 1.000 em julho de 2000 e a abrangência; (c) "CRI e CRA pagam mais por risco e pouca liquidez" e "vencimentos longos" são afirmações gerais sem fato registrado, escritas sem número; (d) a restrição de muitas ofertas a investidores qualificados não entrou (sem fonte); (e) as taxas dos exemplos (12,5%, 7,5%, 13%, 7%, 11%) são didáticas e rotuladas como exemplo só nas legendas dos widgets, não alinhadas ao catálogo (tarefa RC.5.14); (f) sem `docker compose`, e2e nem conferência visual, e o teste de integração do seed não rodou aqui; (g) `/code-review` não rodado.

- **RC.5.6 entregue (2026-10-05):** lições `stableKey` 1.7 (code 1.8, Tesouro Prefixado) e 1.8 (code 1.9, Marcação a mercado) reescritas em `blocks` (`BLOCKS_1_7` e `BLOCKS_1_8` em `backend/src/db/lessonContentTrilha1b.ts`, ligadas em `seedLessons.ts`, textos legados por `legacyText`). *Prefixado:* nome técnico LTN, valor de face, juros embutidos no deságio, taxa de 11,75% rotulada como exemplo, aposta "maior, menor ou igual a R$ 1.000" (certa fora da posição 0), widget `bond-price-calculator` (substitui o "Ver resultado" e mostra o ganho **líquido**: o R$ 199,24 é bruto), pergunta numérica (R$ 909,09 a 10% em 1 ano), prazo maior e preço, IR e custódia, existência do Tesouro Prefixado com Juros Semestrais (vencem em 1º de janeiro), V/F "garante ganhar mais que a Selic" (aposta, custo de oportunidade), "Na plataforma" (taxa e vencimento do catálogo). *Marcação a mercado:* recompra pelo preço do dia, taxa de mercado do título **não é a Selic**, aposta "acima ou abaixo", widget `mtm-seesaw`, numérica (R$ 769,47 a 14% em 2 anos), duration (prazo longo oscila mais), IPCA+ também oscila e Selic quase não, perda só se vender, V/F "o Copom eleva e só então os prefixados caem" (o preço antecipa). Saíram "Copom simulado a cada 21 dias reais", "Sandbox", "ganho extraordinário" e "exatamente a sua rentabilidade". *Fatos novos:* `tesouro-prefixado-regras` (LTN, NTN-F, 1º de janeiro, face de R$ 1.000) e `tesouro-resgate-preco-mercado`, ambos lidos na página de regras do Tesouro Direto. Baseline de conteúdo encolheu 3. Validou: backend lint/build/`npm test` (2702) e os dois `blocks` contra o schema Zod. **Ressalvas:** (a) `tesouro-prefixado-regras` é `trecho-de-busca`: a página aberta confirma a NTN-F e usa exemplo de LTN vencendo em 01/01, mas o face de R$ 1.000 e o "sempre 1º de janeiro" vêm do resultado de busca; reabrir na RC.8.1; (b) o cupom de 10% da NTN-F não foi confirmado e a lição não o cita; (c) a lição não calcula o prazo em dias úteis (base 252) e usa anos corridos, como os widgets; (d) o bloco "Na plataforma" da 1.8 descreve a taxa de mercado reagindo ao Copom e a eventos, sem conferir no motor a frequência de reprecificação; (e) sem `docker compose`, e2e nem conferência visual, e o teste de integração do seed (Postgres) não rodou aqui; (f) `/code-review` não rodado.

- **RC.4.6 entregue (2026-10-04):** lição nova `stableKey` `reserva-emergencia`, `code` `1.3`, `sortOrder` 9, "Reserva de emergência: quanto e onde", logo depois do Tesouro Selic (`BLOCKS_RESERVA` em `backend/src/db/lessonContentTrilha1b.ts`): função da reserva, quanto (3 a 6 meses do custo essencial, 6 a 12 com renda variável, **rotulado como regra de bolso**), aposta "custo de R$ 3.000, qual meta?" (certa fora da posição 0), onde guardar (alta liquidez e baixo risco), erro comum (carência ou preço oscilando), "trocar por ações para render mais" falso, repor depois de usar, bloco "Na plataforma" (o dinheiro da plataforma é de treino, não é a reserva real); 3 perguntas além da aposta. **Dois widgets novos** nos dois lados do contrato: `emergency-fund-calculator` (custo essencial, tipo de renda, quanto guarda por mês: meta em R$, prazo sem rendimento; conta em `features/lessons/widgets/emergencyMath` com teste table-driven) e `where-to-keep` (6 produtos, "Serve"/"Não serve" em botões, não arrastar, para funcionar em teclado e toque; o motivo aparece depois de qualquer resposta). **Fato novo `reserva-emergencia-bcb`** (Caderno de Educação Financeira do Banco Central baixado e lido: reserva em aplicação de alta liquidez e baixo risco; o Caderno **não** fixa número de meses, então 3 a 6 e 6 a 12 são regra de bolso). **Renumeração:** como a inserção desloca as lições seguintes, as da Trilha 1 de `stableKey` `1.3` a `1.11` passaram a `code` `1.4` a `1.12` e o `sortOrder` das 29 lições seguintes subiu um; `insertLessonInMiddle` ganhou o parâmetro `allSeeds` (códigos provisórios e definitivos dentro da mesma transação, para a renumeração em cadeia não bater na unicidade do `code`); `termPrerequisites.ts`, `originLesson` do glossário e o baseline de conteúdo seguiram a nova numeração (baseline: 9 chaves renomeadas, nenhuma violação nova). Teste de integração reescrito para as duas inserções do meio (Trilha 0 e Trilha 1) com 4 usuários (5, 4, 8 e 7 lições antigas concluídas): só quem já passou do ponto recebe a dispensa, `id` das linhas preservado, `code` em cadeia certo, idempotente; rodado num Postgres 16 descartável. Validou: backend lint/build/`npm test` (2696), frontend `tsc -b`/oxlint/`vitest` (1411). **Ressalvas:** (a) sem `docker compose`, e2e nem conferência visual; (b) **o Tesouro Reserva** (lançado em 11/05/2026, rende 100% da Selic over, sem marcação a mercado, só no Banco do Brasil por ora) apareceu só em resultado de busca (gov.br devolveu 401), por isso a lição **não o cita**; vale reabrir e incluir em `where-to-keep` quando a página abrir; (c) a lição fala de "alta liquidez" sem número de dias, e não compara rendimentos (a comparação poupança x Tesouro Selic já é da 0.6); (d) a numeração de lição citada em outros textos do backlog e na spec (1.3 a 1.11) está defasada em um: ajuste fica para a RC.8.2; (e) `/code-review` não rodado.

- **RC.5.4 entregue (2026-10-04):** lição 1.3 reescrita em `blocks` (`BLOCKS_1_3` em `backend/src/db/lessonContentTrilha1b.ts`). Como a lição 0.5 (RC.4.1) já ensina quem é o Copom, as 8 reuniões, meta x efetiva e traz `copom-timeline` e `selic-ipca-chart`, a 1.3 não os repete: foca no que o Copom olha. Meta de inflação de 3% com tolerância de 1,5 ponto (fato `meta-inflacao`) com pergunta do intervalo; aposta "IPCA a 6%, acima do teto: elevar, reduzir ou manter?" (certa fora da posição 0, tipo `reflection`, sem o widget ao vivo); **widget novo `inflation-selic-seesaw`** (gangorra inflação x Selic: controle de 0% a 15%, mostra a faixa da meta, a pressão sobre a Selic e a cadeia crédito, consumo, inflação; texto diz que é intuição e que o Copom não aplica fórmula), registrado nos dois lados do contrato, `copomLean` em `macroMath` com teste table-driven, teste de interação e `.docs/backend/lessons.md`; duas perguntas (inflação a 3,5%, "a Selic subiu, o que rende mais"); bloco "Na plataforma" com os 45 dias e a regra simplificada de reação (Taylor, taxa neutra, arredondamento de 0,25 e "nunca negativa" saíram do texto). Também corrigido o "21 dias" do bloco da 0.5 para 45 (valor do motor, `CopomMeetingIntervalDays`). Baseline de conteúdo encolheu 5. Validou: backend lint/build/`npm test`, frontend `tsc -b`/oxlint/`vitest`. **Ressalvas:** (a) sem `docker compose`, e2e nem conferência visual; (b) os cartões de indicadores ao vivo saíram da lição, e o `microDecisionType` `live_macro_indicator` ficou sem uso na 1.3; (c) a ligação Selic/prefixado fica em uma frase, a lição de marcação a mercado (RC.5.6) aprofunda; (d) a "Selic hoje no mundo real" sugerida na auditoria ficou de fora (exige dado estático versionado); (e) `/code-review` não rodado.

- **RC.5.3 entregue (2026-10-04):** lições 1.1 e 1.2 reescritas em `blocks` (`backend/src/db/lessonContentTrilha1b.ts`, ligado em `seedLessons.ts`; textos legados derivados por `legacyText`). *1.1:* três tipos de regra (prefixada, pós-fixada, híbrida, com os termos do glossário inline), pergunta da híbrida (IPCA + 6%), aposta "título que acompanha a Selic ainda é renda fixa?" (certa fora da posição 0), pergunta verdadeiro/falso "valor final conhecido de antemão", sem "o mesmo tipo de bônus da lição 0.1" e sem "taxa real de cada produto"; reserva de emergência como promessa da trilha. *1.2:* aposta corrigida para "rende mais, menos ou igual por dia" (o preço unitário sobe todo dia útil; a Selic muda a velocidade), pergunta V/F sobre o PU, IR regressivo, IOF abaixo de 30 dias e custódia de 0,20% a.a. sem cobrança até R$ 10 mil no Selic (pergunta numérica com R$ 8.000), resgate em dia útil sem prometer horário, bloco "Na plataforma"; saíram "o mais líquido", "porto seguro", "spec do TCC" e "resgate sem perda relevante". *Fato novo* `tesouro-resgate-liquidez` em `regulatoryFacts.ts` (a auditoria dizia só D+1 e está desatualizada: o resgate pode cair no mesmo dia útil se pedido até cerca das 13h). Baseline de conteúdo encolheu 1 (número de lição na 1.1). Validou: backend lint/build/`npm test` (2694). **Ressalvas:** (a) o fato de resgate é `trecho-de-busca`: as páginas do Tesouro Direto e do gov.br devolveram 401/403 à leitura automática, reabrir no navegador na RC.8.1; por isso a lição não cita horário; (b) sem `docker compose`, e2e nem conferência visual; (c) a 1.2 não ganhou widget (as contas de custo viram pergunta numérica); (d) a RC.4.6 (reserva) ainda não existe, a 1.1 só a promete; (e) `/code-review` não rodado.

- **RC.5.2 entregue (2026-10-04):** *Fatos:* a Lei 12.703/2012 foi lida de novo (art. 1º, II, alíneas a e b; art. 2º, saldo até 3 de maio de 2012 mantém TR mais 0,5% ao mês) e entrou o fato novo `poupanca-isencao-ir-pf` (Manual do Meu Imposto de Renda, Receita Federal, página lida: poupança entre os rendimentos isentos e não tributáveis, o que fecha a pendência da isenção que só tinha referência indireta). *Lição* `0.6` (`stableKey` `0.5`, mesma linha e mesmo progresso) reescrita em `BLOCKS_POUPANCA` (`lessonContentTrilha0b.ts`): título "Poupança: quando ela perde e quando não", 6 cartões curtos, aposta com a Selic de 14% e TR de 0,15% ao mês (exemplos hipotéticos) cuja resposta é "menor", três perguntas (regra com Selic a 10% e a 7%, "isenta sempre vence"), widgets `savings-vs-selic` (novo) e `real-return`, bloco "Na plataforma" (poupança não é produto da plataforma, o Tesouro Selic é o ponto de comparação). Saíram "sempre um pouco atrás", "a regra da poupança é fixa" e "Selic simulada nesta plataforma"; entrou a regra dos dois lados dos 8,5%, a TR positiva no cálculo, a comparação líquida e o saldo anterior a 2012. *Widget `savings-vs-selic`* (`selicPct`, `trMonthlyPct`, `amount`, `months`, todas com default): controles de meta da Selic, TR e prazo, regra aplicada escrita, poupança contra Tesouro Selic líquido, `aria-live`, resumo textual; contas em `features/lessons/widgets/savingsMath` (juros e TR compostos entre si, 70% da meta ao ano mensalizada, IR regressivo sobre o ganho, 30 dias por mês) com teste table-driven, inclusive o degrau na fronteira (8,5% rende 5,95% ao ano, 8,51% rende 6,17%). Contrato nos dois lados e registro; `.docs/backend/lessons.md`. O baseline do conteúdo proibido encolheu em 2 (as duas violações da 0.6 sumiram). Validou: backend lint/build/`npm test` (2715, com o teste de integração rodando num Postgres descartável), frontend `tsc -b`/`vitest` (1390). **Ressalvas:** (a) sem conferência visual nos 3 breakpoints, sem navegador e sem `docker compose`; (b) a conta do Tesouro Selic é aproximada (100% da meta, sem custódia, sem a diferença de cerca de 0,10 ponto entre meta e efetiva, 30 dias por mês), e o widget diz isso; (c) a lição afirma "a poupança não paga IR para pessoa física" com base na página da Receita (que diz isentos e não tributáveis); a norma específica da isenção não foi aberta; (d) a narrativa histórica do porquê da regra de 2012 (que a auditoria sugeria) ficou fora, por não estar validada; (e) a lição não foi renderizada no player.

- **RC.5.1 entregue (2026-10-04):** lições 0.1 a 0.4 reescritas em `blocks`
  (`backend/src/db/lessonContentTrilha0a.ts`; `legacyText` foi para `lessonText.ts`). *0.1:* investir como
  empréstimo ou sociedade (a definição "ceder capital a alguém" valia só para renda fixa), dinheiro parado perde
  poder de compra, sem "de verdade" nem "geralmente deixa valor na mesa", capital de R$ 10.000 e desbloqueio das
  trilhas vão para o bloco "Na plataforma"; 3 checkpoints; a micro-decisão segue aberta, sem gabarito. *0.2:* sem
  "TCC cap. 2.1.1" (já limpo na RC.1.4), "todo investimento real (Tesouro, CDB, ações)" corrigido para "a renda fixa"
  (ação não tem juros), diferença no curto prazo depende da taxa, calculadora no registro (`growth-calculator`),
  R$ 3.000 contra cerca de R$ 6.727 em 20 anos, 3 checkpoints. *0.3:* define inflação e IPCA inline, meta de 3% com
  tolerância de 1,5 ponto (fato `meta-inflacao`), distrator R$ 5 no lugar de R$ 95 e R$ 110, 2 checkpoints.
  *0.4:* sem CDB antes da 1.4 (diz "aplicação"), IPCA definido, IR sobre o ganho nominal, "indicadores nominais"
  no bloco "Na plataforma", 2 checkpoints. Alternativa certa fora da posição 0 onde há aposta. Baselines: saem
  `nesta-plataforma` da 0.1 e da 0.4; `termPrerequisites.test.ts` agora espera sem aviso de IPCA na 0.3 e 0.4.
  Validou: backend lint/build/`npm test` (832). **Ressalvas:** (a) sem `docker compose`, e2e nem conferência
  visual; (b) a 0.4 ainda cita "Tesouro" e "CDB" apenas na 0.2/1.x, sem uso novo; (c) o "IPCA dá 1,5% a 4,5%" da
  explicação é conta sobre o fato da meta, não fato novo; (d) as lições 0.1 a 0.4 usam `{{inflação}}` e `{{IPCA}}`
  inline em vez de depender da RC.4.1.
- **RC.4.1 desbloqueada (2026-10-04):** a progressão com dispensa (N.24) entrou na `main` (PR #55) e foi integrada
  à pilha de PRs das RC (#62 a #83, encadeados, migrations `0022` a `0024` renumeradas depois da `0021`). Falta só
  mesclar a pilha na `main` para começar RC.4.1, RC.4.2 e RC.4.4 a RC.4.9 (partir da `main` já com ela).
- **RC.5.5 entregue (2026-10-04):** lições 1.4, 1.5 e 1.6 reescritas no contrato `blocks`, em
  `backend/src/db/lessonContentTrilha1a.ts` (os textos legados `scenarioText`/`microDecisionPrompt`/
  `revelationText` agora são derivados dos blocos de texto por `legacyText`, então o conteúdo existe uma vez só).
  *1.4:* CDB como empréstimo ao banco, % do CDI, FGC completo (R$ 250 mil por CPF e por conglomerado, teto de R$ 1
  milhão em 4 anos, títulos públicos fora, "entra se o banco for liquidado"), sem "tão seguro quanto o Tesouro",
  3 perguntas (1 na aposta de 3 alternativas e 3 checkpoints), bloco "Na plataforma" (CDB fictício a 110% do CDI).
  *1.5:* IR retido na fonte, só sobre o lucro, `ir-regressive-table` na abertura, IOF de 96% a 0% em 30 dias, 3
  checkpoints. *1.6:* isenção só para pessoa física, prazo mínimo de 6 meses da LCI (o exemplo de 60 dias, que não
  existe, saiu), `equivalent-rate` na micro-decisão e `product-comparator` na revelação, exemplo didático declarado
  (CDI a 10%: CDB 11% e LCI 9%, proporções do catálogo), faixa de 720 dias corrigida (17,5% até 720, 15% acima), 4
  checkpoints; os dois `[revelar]` ("Ver resultado") saíram; `unlocksDescription` sem "real". Alternativa certa da
  aposta fora da posição 0 nas três. Novo teste de seed: fase com `blocks` que diz "calcule" exige widget na fase.
  Baseline de conteúdo encolheu 1 (número de lição na 1.6). Validou: backend lint/build/`npm test` (831). Nenhum
  fato novo foi introduzido: todos já estavam em `regulatoryFacts.ts` com `verifiedAt` de 2026-10-04.
  **Ressalvas:** (a) sem `docker compose`, sem conferência visual e sem rodar o e2e das lições; (b) o
  `fgc-coverage-bar` (RC.3.4b) não existe ainda, então o FGC usa texto e pergunta numérica; (c) os fatos de FGC
  "entra na liquidação" e "CRA fora" ficaram simplificados/omitidos por falta de fonte lida (a 1.11 deve tratar);
  (d) as lições 1.4 a 1.6 ainda usam CDI e carência sem lição própria (RC.4.1), cobertos por `{{termo}}` inline;
  (e) quem já concluiu essas lições não é afetado (seed só substitui conteúdo, progresso fica); (f) a revisão
  `/code-review` e a leitura contra o guia RC.1.6 não foram feitas por outra sessão.
- **Nota de esforço:** a Fase 5 reescreve as 35 lições atuais (as 8 novas são RC.4.1, RC.4.2 e RC.4.4 a RC.4.9), com margem de crescimento
  para o autor ("muita margem para adição de coisas"). Cada tarefa pode se dividir em duas sessões se passar de 4
  lições com widget novo.
- **Revisão de qualidade de cada tarefa:** `/code-review` no código; leitura do texto final contra o guia RC.1.6 e
  contra o anexo da lição; checagem de cada número contra RC.1.3.
- **Depende de:** Fases 1 a 3 (por lição: do widget que ela usa) e Fase 4 para as ordens novas.

---

## Fase 6: Calendário

Fonte: `analise-calendario.md`. A Trilha B (UX) é independente e entrega valor primeiro.

### Trilha B: "o que me afeta"

- **RC.6.1 ✅ Relevância no engine (B.1):** `Event` ganha `relevance` (mine/market), `relevance_reason`,
  `estimated_amount`, `amount_is_estimate`, `user_quantity`; `summary` por dia; `scope`/`market_limit`; valor
  exato de provento a partir de `dividend_event_recipients` quando a data ex já passou, estimativa antes. Sem dado
  de terceiros (RNF09). `.docs/engine/calendar.md`.
- **RC.6.2 ✅ Backend (B.2):** `marketCalendarQuerySchema` (`scope`, `market_limit`), port/tipos, router e caso de
  uso testados; `user_id` na query ignorado; `.docs/backend/market.md`.
- **RC.6.3 ✅ Frontend: dados (B.3):** tipos, função pura `calendarRelevance`, segmented control Meus/Todos
  persistido.
- **RC.6.4 ✅ Frontend: UI (B.4):** rascunho antes. Faixa "Para você" em destaque (sólido para exato, tracejado para
  estimado, convenção do `identidade-visual-padroes.md`), "No mercado" recolhível e secundário, marcador duplo na
  faixa de dias e na grade, relevância nunca só por cor, estados vazios, 3 breakpoints.
- **RC.6.5 ✅ Decisões e docs (B.5):** registrar JCP, instante do snapshot e Copom como "mine" em
  `pontos-em-aberto-decisao-produto.md` (D9, D10).

- **RC.6.1 entregue (2026-10-05):** `marketcalendar.Service.CalendarWith(ctx, userID, from, to, Options)` (o `Calendar` antigo virou um invólucro sem limite). `Event` ganhou `Relevance`, `RelevanceReason`, `EstimatedAmount`, `AmountIsEstimate` e `UserQuantity`; `DayEntry` ganhou `Summary` (`mine`/`market`); `Result` traz `MarketTotal` e `MarketShown`. Regras: fato `scope: user` é `mine` (motivos `own_fact`, `fixed_income_position` no vencimento, `salary` inclusive o futuro); provento é `mine` com snapshot (valor **exato**, `amount_is_estimate` falso, vale para quem vendeu depois da data-ex) ou, antes da data-ex, com posição atual (estimativa); relatório é `mine` com posição em **ação**; Copom e macro são `market`; sem `user_id`, tudo `market`; depois da data-ex sem snapshot o usuário não tem direito (comprou tarde). `scope=mine|all` e `market_limit` (0 a 200, padrão 50, os mais próximos de hoje) no handler, com 400 nos inválidos. `UserFacts` ganhou `HoldingsOf` e `DividendRecipientsBetween`, implementados em `CalendarRepository` (só as linhas do próprio usuário, sem posição zerada nem sandbox). `.docs/engine/calendar.md` atualizado. Testes: 9 de domínio com fakes (posição, snapshot exato, comprou tarde, relatório só com ação, motivos, salário futuro, escopo e resumo, limite pelos mais próximos, sem usuário), 3 do handler (query, 400, serialização) e 1 de SQL num Postgres 16 descartável (posições e destinatários, privacidade entre usuários). Validou: `go build`, `go test ./...`, `golangci-lint` v2.12.2 (0 issues). **Ressalvas:** (a) o relatório continua um fato global único (não por ticker): é `mine` se o usuário tem qualquer ação; relatório por empresa depende do escalonamento (RC.6.8); (b) o `market_limit` padrão de 50 já vale para o backend atual, que repassa a query sem o parâmetro (hoje o catálogo cabe folgado); (c) vencimento de renda fixa sem `estimated_amount`, só `quantity` (o valor depende do rendimento); (d) ordens abertas (`order_pending`) ficaram de fora, como a análise já marcava como opcional; (e) o teste de SQL só rodou com a migration `000040_clean_visible_catalog_text` movida para fora, por colisão de número com `000040_tick_runs_and_scheduler_control` (achado 035 em `pontos-em-aberto-decisao-produto.md`); (f) sem `docker compose up` de ponta a ponta; (g) `/code-review` não rodado.

- **RC.6.2 entregue (2026-10-05):** `marketCalendarQuerySchema` ganhou `scope` (`mine`/`all`) e `market_limit` (inteiro 0 a 200, `z.coerce`); a porta `MarketCalendarReader` ganhou `CalendarScope`, os campos de relevância no `CalendarEvent` (`relevance`, `relevance_reason`, `estimated_amount`, `amount_is_estimate`, `user_quantity`, e o `reference_month` que faltava desde o achado 025), `summary` por dia e `market_total`/`market_shown`; `GetMarketCalendarUseCase` repassa `scope` e `marketLimit`; o adapter do motor só manda os parâmetros quando informados (sem eles o motor decide: `all` e 50); o router repassa. `user_id` na query segue ignorado (sempre o do token). Testes: caso de uso, adapter (URL com `scope` e `market_limit`), router (repasse, 400 para `scope=todos`, `market_limit` -1, 201 e `abc`, sem chamar o motor). `.docs/backend/market.md` atualizado. Validou: backend lint/build/`npm test` (2719). **Ressalvas:** sem `docker compose up` de ponta a ponta com o motor novo, e o frontend ainda não manda `scope=mine` (RC.6.3); o contrato é aditivo, então o frontend atual segue funcionando.

- **RC.6.3 entregue (2026-10-06):** `services/market/types.ts` espelha o contrato do backend (`relevance`, `relevance_reason`, `estimated_amount`, `amount_is_estimate`, `user_quantity` no evento; `summary` por dia; `market_total`/`market_shown`; `CalendarScope`) e `getMarketCalendar` aceita `{ scope, marketLimit }` (só manda o que for informado). `features/market/calendarRelevance` é a função pura que separa "Para você" e "No mercado" em ordem cronológica, com contadores do `summary` do motor (que contam antes do corte) e a soma dos proventos futuros do usuário (`upcomingPayoutIsEstimate` se algum for estimativa). `features/market/useCalendarScope` guarda Meus/Todos em `localStorage` (`app.calendar.scope`), padrão `mine`, tolerando armazenamento bloqueado. `useMarketCalendarQuery` ganhou o parâmetro `scope` (na chave da query) e o `MarketCalendarPanel` pede `scope=mine` por padrão, com o novo `CalendarScopeToggle` (radiogroup Meus/Todos, estado ativo também por peso de fonte). Fixtures de teste ganharam `calendarEvent`/`calendarDay`/`calendarWindow` (relevância e `summary` derivados). Testes: função pura (4), hook (3), toggle, serviço (query string), painel (abre em `mine`, troca pede `all` e persiste, lembra na abertura seguinte). Validou: `vitest` (1574), `tsc -b`, lint sem erros. **Ressalvas:** o painel ainda não separa as duas seções nem mostra "No mercado" (RC.6.4): com o padrão `mine` o Copom e eventos macro só aparecem em "Todos" até lá; o toggle foi posto sem rascunho de layout, a RC.6.4 o reposiciona; `useNextSalaryPayment` e o teatro de virada de dia seguem sem `scope` (salário é `mine` de qualquer forma); sem `docker compose up` de ponta a ponta nem `/code-review`.

- **RC.6.4 entregue (2026-10-06):** rascunho de layout (mesma árvore nos 3 breakpoints; o desktop mantém o painel lateral de 440px com a grade do trimestre em cima):
  ```
  [ Meus | Todos ]
  faixa de dias:  qua 08  [▮2] [┄●┄]      ▮ pílula cheia = para você (com número)
  grade (desktop): célula com barra grossa embaixo = tem fato seu   ┄ tracejado = só mercado
  ┌ Para você (2) ─────────────────────┐  faixa em destaque (borda e fundo da marca)
  │ Proventos a receber: R$ 10,80 (estimado)
  │ Aconteceu | Vem aí  (tablet: 2 colunas; mobile: 1)
  │  item sólido = valor confirmado · tracejado = previsto/estimado, valor em texto
  └────────────────────────────────────┘
  ▸ No mercado   (só em "Todos"; recolhível, tracejado; "Mostrando X de Y" se houve corte)
  Em "Meus": "Mostrando só o que afeta você. N fatos do mercado ficam de fora. [Ver o mercado]"
  ```
  Feito: `MarketCalendarPanel` separa "Para você" (faixa em destaque, soma dos proventos a pagar, estado vazio "Nada que afete você neste dia.") de "No mercado" (`<details>` secundário, só em "Todos", com aviso de corte por `market_limit`); `CalendarDayStrip` marca o dia com pílula cheia numerada (seu) e ícone tracejado (mercado) e o `aria-label` traz as contagens ("2 para você, 1 no mercado"); `QuarterGrid` usa a barra grossa embaixo para dia com fato seu; `CalendarEventItem` mostra o valor do usuário ("10 unidades · R$ 8,80 (valor confirmado)" ou "(estimado)"), sólido quando confirmado e tracejado quando previsto; legenda ganhou "Para você" e "No mercado". Correção da RC.6.3: o total de proventos soma só o evento de pagamento (a data-ex do mesmo provento leva o mesmo valor e contava em dobro). Relevância nunca só por cor (forma, número e texto). Testes: painel (Meus/Todos, "Para você" x "No mercado", provento confirmado x estimado, marcadores da faixa), `describeCalendarEvent` com valor, `calendarRelevance`. Validou: `vitest` (1579), `tsc -b`, lint sem erros. **Ressalvas:** não conferi em 360/768/1280px nos dois temas (o app exige login; fica para a RC.7.6); a seção "No mercado" some em "Meus" por decisão deste desenho, então Copom e eventos macro só aparecem em "Todos"; sem `docker compose up` de ponta a ponta nem `/code-review`.

- **RC.6.5 entregue (2026-10-06):** achados 036 (JCP e imposto sobre dividendos fora do motor, D9), 037 (instante do snapshot, data-com real x geração, e tolerância do cutover, D10) e 038 (Copom e macro como "No mercado") registrados em `pontos-em-aberto-decisao-produto.md`, cada um com local, opções e status (implementado com o comportamento vigente). Só documentação, sem código; `.docs/backend/market.md` e `.docs/engine/calendar.md` já cobriam as rotas (RC.6.1/RC.6.2). **Pacote P7 fechado** (RC.6.1 a RC.6.5): resta abrir o PR.

### Trilha A: escalonamento por ativo (D8, decidido: entra no escopo)

| Tarefa | Conteúdo | Depende de |
|---|---|---|
| RC.6.5b ✅ | **Calibração com referência real** (antes de codificar): pesquisar em fonte primária (B3, CVM, RI de emissoras, regulamentos de FII) a periodicidade de dividendos/JCP por setor, janela real de divulgação de ITR/DFP, e dia de pagamento de FIIs; registrar parâmetros e fonte em `.claude/calibracao-calendario-proventos.md` no molde de `calibracao-fundamentos-setor.md` | nada |
| RC.6.6 ✅ (A.1) | pacote puro `paymentschedule`: offset por ativo (chave estável: ticker, não UUID), políticas trimestral/semestral/anual, FII no mês-calendário real, pagamento em dia útil; offset 0 reproduz o legado | RC.6.5b |
| RC.6.7 ✅ (A.2) | migrations aditivas (`companies.report_offset_days`, `dividend_policy`, `fii_details.payout_*`, `dividend_events.declared_day/ex_day/recipients_snapshotted`, `schedule_cutover_day`); defaults reproduzem o legado; seed e `CreateCompany` usam `DefaultsFor` | RC.6.6 |
| RC.6.8 ✅ (A.3) | balanço escalonado em `Advance`, ajustando os acoplamentos (macroevento de fundamentos `AssignReportDay`, banda de preço do provento, `cycleIndex` do ruído, `MaxWindowDays`) | RC.6.7 |
| RC.6.9 ✅ (A.4) | proventos de ação por política, pool acumulado no semestral, efeito de preço ancorado na data ex | RC.6.8 |
| RC.6.10 ✅ (A.5) | FIIs no mês real com offset por fundo (5º a 15º dia útil), 12 pagamentos/ano, DY anual-alvo preservado | RC.6.6, RC.6.7 |
| RC.6.11 ✅ (A.6) | declaração separada e snapshot na data ex; `ListDividendPayerAssets` sem carregar holders de todo ativo todo tick; benchmark em catálogo sintético | RC.6.9, RC.6.10 |
| RC.6.12 (A.7/A.8, opcional) | ETFs e evento macro por empresa | RC.6.8 |

- **Regras:** `market_events` e `dividend_events` já pagos ficam intactos (event sourcing); cutover por dia de
  corte; validar em catálogo sintético com 1.000 ativos (projetar para o crescimento, não para os 35 de hoje);
  determinismo e testes table-driven; medir o tick.

- **Entregável RC.6.5b (2026-10-06):** `.claude/calibracao-calendario-proventos.md`, no molde da calibração de fundamentos, com selo por parâmetro ([FONTE], [OBSERVADO], [ILUSTRATIVO]). Fontes primárias: Resolução CVM 80/2022 (ITR em 45 dias, DFP em 3 meses), regra data-com/data-ex da B3 (data-ex é o dia útil seguinte), Lei 6.404 arts. 202 e 205 (25% mínimo; pagar em até 60 dias da declaração), Lei 8.668/93 art. 10 (FII distribui 95% do lucro de caixa por semestre), política de remuneração da Vale. Observado: calendário 1T25 da B3 (13 balanços em abril, 281 em maio, pico de 64 em 8/5, 38 dias após o trimestre), FIIs concentrados no 10º dia útil (dias 13 a 15 do mês), casos de Vale/WEG (semestral), Petrobras/Ambev (trimestral), bancos e JHSF (mensal). Parâmetros para a RC.6.6/6.7: offset de balanço em `[0,45)` dias (pesos 5/30/65), ex no dia útil seguinte à com, pagamento em ex mais 5 a 30 dias úteis, pesos de periodicidade por setor, FII com data-com no último dia útil e pagamento no 5º a 15º dia útil (pico 10), chave de sorteio por ticker. **Ressalvas:** não existe estatística pública agregada da proporção de empresas por frequência de pagamento, então os pesos de periodicidade são ilustrativos (e mais conservadores que os 60/30/10 da análise); o pagamento mensal de bancos fica fora do motor (mapeado em trimestral); a DFP de 3 meses foi simplificada para a mesma janela de 45 dias; um PDF da B3 e um estudo da UFU não puderam ser lidos (conteúdo binário), então não entram como fonte. Os três pontos a confirmar com o autor estão no fim do documento.

- **Entregável RC.6.6 (2026-10-06):** pacote puro `engine/internal/domain/paymentschedule` (só importa `simcalendar` e `catalog`, sem I/O). `schedule.go`: `AddBusinessDays`, `ReportDay`/`CycleIndex`/`IsReportDay` com offset em **dias úteis** (offset 0 é o legado, sem ajuste de fim de semana; equivalência exaustiva com `fundamentals.IsReportDay` e o índice de ciclo de 0 a 2000 para frequências 7, 30 e 91), `ComDay`, `ExDay` (dia útil seguinte), `PaymentDay`, e as políticas `Quarterly`/`Semiannual`/`Annual` (`EquityPayoutCycles`, `PaysInCycle`, `PoolCycles` para somar o lucro do pool). `fii.go`: `FIIPayoutDays(ano, mês, N)` no mês-calendário real (data-com no último dia útil, ex no seguinte, pagamento no N-ésimo dia útil do mês seguinte). `defaults.go`: `DefaultsFor(ticker, setor)` por hash FNV-1a do **ticker** (offset de balanço 5/30/65, política por setor, defasagens de data-com 0 a 3 e de pagamento 5 a 30 dias úteis, dia útil do FII 5..15 com pico no 10), com as faixas da `calibracao-calendario-proventos.md` (ajustada para dias úteis, motivo: o empurrão de fim de semana juntaria 3 dias de massa na segunda). Testes table-driven (40): dias úteis e fim de semana, equivalência com o legado, balanço sempre em dia útil e único por ciclo, ordem com/ex/pagamento e teto legal de 60 dias, políticas e pool, FII em meses de 28/29/30/31 dias e virada de ano, determinismo e independência da ordem de cadastro, e dispersão em catálogo sintético de 1.000 ativos (pior dia de balanço <= 14%, de FII <= 20% por causa do pico real do 10º dia útil, pesos por setor dentro de 4 pontos). Validou: `go build`, `go test ./...`, `golangci-lint` v2.12.2 (0 issues). Sem rota HTTP, então sem `.docs/`. **Ressalvas:** o pacote ainda não está ligado ao tick (RC.6.7 a RC.6.11); `FIIPayoutDays` devolve o mês de referência dado, a descoberta de "qual mês paga hoje" fica para a RC.6.10; feriados continuam ignorados (como em `simcalendar`); sem `docker compose up` (nada mudou no serviço).

- **Entregável RC.6.7 (2026-10-06):** migration aditiva `000048_payment_schedule` (up e down): `companies.report_offset_days` (dias úteis, 0 a 31), `dividend_policy`, `com_lag_days`, `payment_lag_days`, `schedule_assigned`; `fii_details.payout_business_day` e `schedule_assigned`; `dividend_events.declared_day`, `ex_day` e `recipients_snapshotted` (backfill: declaração e ex pela `ex_date` antiga, snapshot já tirado) com índice parcial dos pendentes de snapshot; `market_calendar.schedule_cutover_day` (nasce no `current_day` do deploy). Todos os defaults reproduzem o legado, com CHECKs iguais aos limites do domínio. Domínio: `catalog.DividendPolicy` (o tipo mora em `catalog`, e `paymentschedule.Policy` virou alias, para não haver ciclo de import), `Company.WithPaymentSchedule` validando as faixas, `fii.Details.PayoutBusinessDay` e `fii.DefaultPayoutBusinessDay`. Infra: `CreateCompany`/`CreateFIIDetails` gravam a agenda, `AssignCompanyScheduleIfUnassigned` e `AssignFIIScheduleIfUnassigned` atribuem uma vez só (idempotente, sem sobrescrever edição), e `saveNewDividends` grava `declared_day`/`ex_day`/`recipients_snapshotted` da geração atual. Seed: empresa usa `DefaultsFor(CNPJ, setor)` (ON e PN dividem a agenda, e a empresa não tem ticker próprio) e FII usa `DefaultsFor(ticker)`; ativo já existente recebe a agenda na próxima rodada. `.docs/engine/catalog.md` documenta as colunas (sem rota nova). Testes: 2 de domínio (`WithPaymentSchedule`, padrão legado) e 2 de integração em Postgres 16 descartável (atribuição idempotente de empresa e FII, CHECKs, e migration descendo e subindo com backfill e dia de corte). Validou: `go build`, `go test ./...` (com `TEST_DATABASE_URL`, integração incluída), `golangci-lint` v2.12.2 (0 issues) e o seed de ponta a ponta no banco descartável (banco novo: 24 empresas e 5 FIIs com agenda; legado resetado: backfill pela segunda rodada; terceira rodada sem mudança). **Ressalvas:** a migration `000040` duplicada (achado 035) obrigou a mover a `000040_clean_visible_catalog_text` para fora só durante o teste (restaurada, nada commitado sobre ela); nenhum código do tick lê as colunas ainda (RC.6.8 em diante); sem `docker compose up` completo (a validação foi no Postgres descartável com o seed e a migration); `/code-review` não rodado.

- **Entregável RC.6.8 (2026-10-06):** o balanço deixa de ser um relógio único e passa a sair no dia de cada empresa. `paymentschedule` ganhou `EffectiveReportDay`, `CycleIndexWithCutover`, `DaysSinceReport` e `MaxReportSpanDays`: o ciclo cujo fim é igual ou anterior a `schedule_cutover_day` sai pelo relógio legado (sem offset), só os que fecham depois usam o offset, então a migração nunca gera dois balanços do mesmo ciclo. `tick.Advance` usa `companyReportCycles` (ciclo, semente do ruído e fim do ciclo por empresa); `CompanyForFundamentals` ganhou `ReportOffsetDays` e `ScheduleCutoverDay`, lidos por `ListCompaniesForFundamentals` (com `COALESCE` do corte). Acoplamentos ajustados: o efeito macro de fundamentos continua guardando o fim do ciclo global em `fundamentals_report_day` e entra no balanço de cada empresa daquele ciclo (eventos já gravados seguem valendo, uma vez); `macroEventDone` só encerra o evento depois da folga máxima de balanço do ciclo (0 se todas as empresas estão no legado); a banda de preço do provento (`dividendPriceEffectPct`) conta desde o último balanço da própria empresa. `Result.IsReportDay`, NAV/reavaliação de FII e ETF continuam no relógio global (A.5 e A.7). Testes: 3 de `Advance` (offsets diferentes reportam em dias diferentes, corte, evento macro no balanço atrasado e conclusão), banda do provento, equivalência de offset 0 com o legado (0 a 1500) e um balanço por ciclo atravessando o corte, mais 1 de integração em Postgres 16 descartável (offset e corte chegam ao tick). Validou: `go build`, `go test ./...` (integração incluída, com a `000040_clean_visible_catalog_text` movida só durante o teste por causa do achado 035; restaurada), `golangci-lint` v2.12.2 (0 issues). Sem rota HTTP, então sem `.docs/`. **Ressalvas:** o calendário (`marketcalendar`, evento `report`) ainda usa o dia global e fica descasado das empresas com offset até ser adaptado (hoje ele não tem a agenda por empresa); evento macro disparado depois do fim do ciclo global e antes do balanço atrasado da empresa vai para o ciclo seguinte (refinamento é a A.8/RC.6.12); sem `docker compose up` completo nem `/code-review`. **Pacote P8 fechado** (RC.6.5b a RC.6.8): resta abrir o PR.

- **Entregável RC.6.9 (2026-10-06):** provento de ação por política, pago em dia útil e com efeito de preço ancorado na data-ex. `paymentschedule.EquityCycleAt` resolve a agenda de um ciclo (balanço, data-ex, pagamento, se paga, ciclos do pool): empresa sem agenda atribuída (`schedule_assigned = false`) ou ciclo que fechou antes do dia de corte segue o legado (todo balanço paga, ex na declaração, pagamento 5 dias corridos depois); os demais usam data-com, data-ex (dia útil seguinte) e pagamento em dia útil, e só pagam nos balanços da política (trimestral todos, semestral 2º e 4º, anual 4º). `tick`: `CompanyForFundamentals` ganhou `ScheduleAssigned`, `DividendPolicy`, `ComLagDays`, `PaymentLagDays` e `PriorNetIncomes` (lucros dos 3 balanços persistidos anteriores, lidos de `company_fundamentals`); `equityPayoutFor` acumula o pool (lucro de hoje mais os ciclos anteriores do semestre ou ano) e `dividendRecordsForCycle` usa o pool e as datas; `DividendRecord.ExDay` é gravado em `dividend_events.ex_date`/`ex_day` (zero vale o dia da geração, como antes, e é o caso de FII). `dividendPriceEffectPct` agora procura o último balanço que **pagou** e conta a banda de 10 dias a partir da data-ex (efeito sobre o pool, não sobre um trimestre). Testes: políticas por balanço, pool acumulado, datas em dia útil e em ordem, legado sem agenda, efeito ancorado na ex (pula balanço que não paga), `EquityCycleAt` e a leitura do repositório em Postgres 16 descartável. Validou: `go build`, `go test ./...` (integração incluída, com a `000040_clean_visible_catalog_text` movida só durante o teste, restaurada), `golangci-lint` v2.12.2 (0 issues). Sem rota HTTP, sem `.docs/`. **Ressalvas:** o snapshot dos elegíveis ainda é tirado na geração (declaração), não na data-ex (RC.6.11, achado 037); a primeira janela de uma política semestral ou anual soma só os balanços que já existem; o seed (RC.6.7) atribui a agenda, então bancos existentes passam a ter política a partir dos ciclos que fecham depois do corte; sem `docker compose up` completo nem `/code-review`.

- **Entregável RC.6.10 (2026-10-06):** FIIs pagam no mês-calendário real, com o dia útil de pagamento de cada fundo. `paymentschedule.FIIPayoutOn(dia, N)` diz se o dia é uma data-ex (o 1º dia útil do mês, seguinte ao último dia útil do mês de referência) e devolve data-com, data-ex e pagamento (N-ésimo dia útil do mês); `LastFIIExDay` dá a data-ex mais recente. `tick`: `DividendPayerAsset` ganhou `FIIScheduleAssigned`, `FIIPayoutBusinessDay` e `ScheduleCutoverDay` (lidos de `fii_details`/`market_calendar`); o provento do FII é gerado **na data-ex** (o snapshot de cotistas é o do fechamento da data-com), com `ExDay` e `PaymentDay` em dia útil. Sem agenda atribuída, ou até o dia de corte, vale o ciclo legado de 30 dias (nunca os dois no mesmo período); depois do corte só a data-ex mensal paga. O valor por cota não mudou (`fii.PayoutYieldPerCyclePct`, 12 pagamentos por ano), então o Dividend Yield anual-alvo de 13,2% é preservado. `fiiDividendPriceEffectPct` conta a banda de 10 dias desde a data-ex do último provento (legado fora da agenda). Testes: uma data-ex por mês (~24 em 2 anos), pagamento do 5º ao 15º dia útil conferido, `LastFIIExDay`, 12 pagamentos em 365 dias com N = 5, 10 e 15, fundos com N diferente pagando em dias diferentes, corte (legado antes, só mensal depois), banda na data-ex e a leitura do repositório (default legado e agenda atribuída) em Postgres 16 descartável. Validou: `go build`, `go test ./...` (integração incluída, com a `000040_clean_visible_catalog_text` movida só durante o teste, restaurada), `golangci-lint` v2.12.2 (0 issues). Sem rota HTTP. **Ressalvas:** a reavaliação trimestral do patrimônio (NetWorth/PortfolioValue) continua no relógio global; o snapshot ainda é o do início do dia da data-ex, e a separação formal declaração/snapshot é a RC.6.11; sem `docker compose up` completo nem `/code-review`.

- **Entregável RC.6.11 (2026-10-06):** declaração separada do snapshot e leitura de posição proporcional aos eventos, não ao catálogo. O provento de ação declarado no balanço com data-ex futura sai com `SnapshotPending` e `recipients_snapshotted = false`; no tick da data-ex `Service.fillDividendRecipients` lê a posição (quem vendeu antes da data-com não recebe, quem comprou depois não recebe, e quem vende na própria data-ex ainda recebe) e `SaveTick` grava os destinatários e marca o evento (`saveDividendSnapshots`). Proventos com data-ex hoje (legado e FII) recebem o snapshot do dia pelo mesmo caminho. `Repository` ganhou `ListDividendHolders` (posição só dos ativos pedidos, uma consulta) e `ListDividendsAwaitingSnapshot` (índice parcial da migration 000048); `ListDividendPayerAssets` deixou de carregar os holders de todo ativo todo tick; `ListPendingDividendPayments(upToDay)` só lê os que vencem até o dia e já têm snapshot (o provento sem snapshot nunca é pago nem marcado como pago). Testes: adiamento do snapshot em `Advance`, dia sem data-ex com 1.000 ativos pagadores sem nenhuma leitura de posição, dia de data-ex lendo só o ativo do provento, provento legado recebendo os elegíveis, benchmark de `dividendRecordsForCycle` em 1.000 ativos (~82 µs), e integração em Postgres 16 descartável do ciclo declaração, fila, snapshot e pagamento. Validou: `go build`, `go test ./...` (integração incluída, com a `000040_clean_visible_catalog_text` movida só durante o teste, restaurada), `golangci-lint` v2.12.2 (0 issues). Sem rota HTTP. O achado 037 (instante do snapshot) passa a estar entregue. **Ressalvas:** o benchmark é de domínio e de chamadas ao repositório (fake), não de tempo de SQL num catálogo grande; um provento cuja data-ex passou com o motor parado recebe a posição do momento em que o motor volta (o snapshot não é retroativo); sem `docker compose up` completo nem `/code-review`. **Pacote P9 fechado** (RC.6.9 a RC.6.11).

---

## Fase 7: Mapa da Trilha, Portfólio e Sandbox

Fonte: `analise-mapa-portfolio-sandbox.md`.

| Tarefa | Escopo | Aceite |
|---|---|---|
| RC.7.1 ✅ | **Marcador "Você está aqui" e grade do mapa (T1).** Etiqueta como filha do `.nodeWrap` do nó atual (`TrackPath/index.tsx:110-114`, `index.module.css:225-244`), centrada acima do círculo, com z-index; grade em CSS no `.canvas` com token `--grid-line` para claro e escuro (hoje `rgba(255,255,255,0.035)` fixo, invisível no tema claro), `preserveAspectRatio="none"` removido; atualizar `identidade-visual-tokens.md`; checar também a dica `.hint` e a bandeira expandida | em 360/768/1280px a etiqueta nunca intersecta nó ou título; grade cobre o canvas inteiro em trilhas de 2, 4 e 15 lições, nos dois temas; testes RTL e `getBoundingClientRect` |
| RC.7.2 ✅ | **Dados do donut (T2, mecânico).** Filtrar `isSandbox` (SAND3 entra hoje), base `markPrice ?? averagePrice` (D6) | soma das fatias igual ao `liveInvested` do card; nenhum ticker de Sandbox |
| RC.7.3 ✅ | **Donut interativo com R$ (T3).** Arcos em SVG (hoje um `conic-gradient` em `role="img"`), tooltip em hover (desktop) e toque/clique (mobile), foco por teclado (Tab, Enter, setas, Esc), furo mostra o total por padrão, legenda com R$ e %, `aria-label` por fatia, sem lib nova | informação nunca só em hover; R$ e % corretos; 3 breakpoints |
| RC.7.4 ✅ | **Cards Mercado Ao Vivo e Sandbox (T4).** Implementar a opção decidida em D5 (recomendada B: faixa compacta que só aparece com posição Sandbox, destinos distintos, ex. `/extrato?escopo=aprendizado`); estado vazio sem "R$ 0,00" gigante; se mudar, atualizar spec 3.1, inventário 2.1 e RF12 | com e sem posição Sandbox; tela mais curta em mobile; decisão registrada |
| RC.7.5 | **Composição desktop do Portfólio (T5).** `pages/Portfolio/index.module.css:5-11` fixa `max-width: 720px` em coluna única em todos os breakpoints, contra a regra "desktop não é mobile esticado"; grid de 2 colunas a partir de 1024px, skeletons nos cards (hoje "Carregando..." com salto de layout), cabeçalho mobile alinhado, affordance nos cards clicáveis | 3 breakpoints sem espaço morto; sem salto de layout |
| RC.7.6 | **Varredura visual com navegador logado (T6).** Rodar o app em 360/768/1280, claro e escuro; validar as hipóteses do anexo (`TrackCard` e `AchievementsGrid` de altura fixa com texto longo, `.hint` colidindo a 220px); abrir tarefa para cada achado confirmado | lista validada com capturas |
- **Entregável RC.7.1 (2026-10-04):** etiqueta "Você está aqui" agora é filha do `.nodeWrap` do nó atual (`TrackPath`), centrada
  acima do círculo (`bottom` 34px, 40px no desktop), `z-index` 2 e wrap atual em 3; a linha-guia tracejada ficou como
  elemento próprio sem etiqueta. Grade passou do `<pattern>` do SVG para `background-image` do `.canvas` com o token
  `--grid-line` (claro e escuro, em `index.css` e `identidade-visual-tokens.md`). O `preserveAspectRatio="none"` do
  SVG **foi mantido**: ele é o que alinha o traçado às posições em % dos nós; só a grade saiu dele. Testes RTL: etiqueta
  única e dentro do nó atual com a lição disponível nos índices 0, 1, 2, 3 e 5, e SVG sem `pattern`. Validou: `vitest`
  (844), `tsc -b`, lint. **Ressalva:** a conferência por `getBoundingClientRect` em 360/768/1280px nos dois temas não
  foi feita (o app exige login e o jsdom não mede layout); fica para a RC.7.6, que roda o app logado no navegador.

- **Entregável RC.7.2 (2026-10-04):** `frontend/src/features/portfolio/distribution` ignora posição `isSandbox` e valoriza
  por `markPrice ?? averagePrice`, igual a `calculateAccountTotals`; testes cobrem Sandbox fora, preço de mercado e
  soma das fatias igual ao `liveInvested`. Validou: `vitest` (839), `tsc -b` e `lint` do frontend.

- **Entregável RC.7.3 (2026-10-07):** `components/organisms/DistributionChart` reescrito: anel em SVG (um `circle` com
  `stroke-dasharray` por fatia, respiro de 1,2 unidade entre segmentos, sem lib nova), furo mostrando o "Total
  investido" por padrão e, na fatia ativa, nome, R$ e % (`aria-live="polite"`). Hover no arco ou na legenda destaca
  (as demais esmaecem); clique/toque fixa a fatia (clicar de novo desfaz). A legenda virou lista de botões
  (`aria-pressed`, `aria-label` com nome, R$ e %), sempre com R$ e % visíveis, então nada fica só em hover; Tab entra,
  setas movem o foco entre categorias, Enter/Espaço fixam e Esc limpa. Anel de 140 para 180px; legenda com
  `min-width` e quebra abaixo do anel em telas estreitas. Testes RTL em `DistributionChart/index.test.tsx` (4).
  Validou: `vitest` (1690), `tsc -b`, lint e prettier. **Ressalva:** conferência visual em 360/768/1280px nos dois
  temas não feita (app exige login); fica para a RC.7.6.

- **Entregável RC.7.4 (2026-10-07):** `NetWorthCards`: Mercado Ao Vivo em largura total; o Sandbox virou faixa compacta
  (selo, R$, "Não conta pro ranking", chevron) que só aparece com posição `isSandbox` de quantidade > 0 e navega a
  `/extrato?escopo=aprendizado`; sem posição, uma linha de dica (D7), sem R$ 0,00. O Extrato ganhou o filtro "Escopo"
  (Tudo / Modo Aprendizado / Mercado Ao Vivo) lido de `?escopo=`, com evento sem ativo (depósito, salário) contado
  como da conta. Inventário 2.1 atualizado; a spec 3.1 e o RF12 já exigem só "distinção visual", mantida. Testes:
  `NetWorthCards/index.test.tsx` (4), caso novo no Extrato, ajuste no Portfólio. Validou: `vitest`, `tsc -b`, lint,
  prettier. **Ressalva:** tela mais curta em mobile não medida no navegador (RC.7.6).

---

## Fase 8: Fechamento

### RC.8.1 · Auditoria final de conteúdo

- Reler as 43 lições no app (desktop e mobile), passar RC.1.1 e RC.1.2 sem avisos, checar cada fato contra RC.1.3,
  confirmar que nenhuma lição manda calcular fora, tem pergunta que avança no erro ou termo não introduzido.
- Jornada e2e completa (`backend/test/e2e/`) percorrendo a trilha com respostas certas e erradas.

### RC.8.2 · Atualizar documentação de referência

- `especificacao-plataforma-investimentos.md` (currículo passa de 35 para 43 lições, regras do player,
  changelog), `inventario-telas-plataforma-investimentos.md` (Portfólio, Calendário, Lição, Mapa),
  `identidade-visual-padroes.md` e `-tokens.md` (grade do mapa, `LockedGate`, `PlatformNote`, calendário),
  `.docs/backend/lessons.md`, `.docs/backend/market.md`, `.docs/engine/calendar.md`, `CLAUDE.md` (tabela de
  documentos) e `backlog-pendencias-consolidado.md`.

---

## Como executar a próxima tarefa

**Gatilho:** quando o autor pedir "próxima tarefa do backlog de revisão" (ou equivalente), a próxima é a **primeira
tarefa sem ✅ do primeiro pacote aberto** da "Sequência sugerida" abaixo, respeitando "Depende de" (se a primeira
candidata estiver bloqueada por tarefa não concluída, pegar a primeira desbloqueada e dizer isso). Uma tarefa por
sessão, salvo pedido do autor.

**Passo a passo de cada sessão:**
1. Ler este arquivo (Objetivo, Princípios, a tarefa, suas dependências e decisões D#) e o anexo de
   `.claude/revisao-trilhas-anexos/` citado nela. Não redecidir o que está marcado DECIDIDO.
2. Branch do **pacote** (`rc-p<n>-<tema>`, ex.: `rc-p1-trilha-0`), criada a partir da `main` atualizada na primeira
   tarefa do pacote e reaproveitada nas seguintes. **Base atual (decisão do autor, 2026-10-04): enquanto a pilha RC (PR #86) não for mesclada, a branch base é `rc-2-1-revisar-licoes`, não a `main`**; o PR do pacote abre contra ela. Depois do merge do #86, volta a valer a `main`. Se o pacote depender de outro ainda não mesclado, dizer ao autor.
3. Implementar só essa tarefa, um commit por tarefa, seguindo o checklist do `CLAUDE.md` da camada tocada (testes junto,
   lint/build, `.docs/` se mexer em rota, validação em `docker compose up`). Telas novas nos 3 breakpoints; sem
   travessão como pontuação em texto de UI; mudança de padrão visual pede rascunho antes.
4. Tarefa de conteúdo: seguir a regra de entrada da Fase 5 (validação RC.1.7, fonte primária pesquisada na web,
   fato registrado em RC.1.3 antes do texto) e o Princípio 0 (leve, cartões curtos).
5. Verificar os critérios de aceite. Ao concluir, marcar ✅ no título da tarefa e acrescentar um bullet
   **Entregável** (o que foi feito, arquivos principais, como validou). Atualizar o `backlog-pendencias-consolidado.md`.
6. Se achar gap que exige decisão de produto fora deste arquivo, registrar em `pontos-em-aberto-decisao-produto.md`.
7. Fim: um commit por tarefa e `git push` da branch do pacote. **O PR abre quando o pacote fecha** (todas as tarefas
   dele ✅), com o autor avisado; um PR por pacote, nunca um por tarefa. Resumir ao autor o que foi feito, o que
   validou e qual é a próxima tarefa do pacote.

---

## Sequência sugerida (agrupada em pacotes, um PR por pacote)

**Regra de PR (2026-10-04):** a revisão gerou 22 PRs encadeados (#62 a #83), pequenos demais para revisar. Daqui em
diante **um PR por pacote**, abaixo. Dentro do pacote continua valendo **uma sessão por tarefa e um commit por
tarefa** (rollback e revisão por commit), mas a branch e o PR são do pacote: `rc-p<n>-<tema>`, partindo da `main`
atualizada, com PR aberto **quando o pacote fecha** (todas as tarefas ✅), não a cada tarefa. O critério de
agrupamento foi: (a) **widget entra no mesmo PR da lição que o usa**, para não nascer código sem consumidor; (b)
mesma camada e mesmos arquivos; (c) a mesma verificação de ponta a ponta; (d) a ordem de dependência dentro do
pacote é a da lista.

**Pacotes já entregues:** Fases 1 e 2 (menos RC.2.6), RC.3.1 a RC.3.3, RC.3.4a, RC.3.5, RC.5.1, RC.5.5, RC.7.1 e
RC.7.2, hoje na pilha #62 a #83 (mesclar em ordem; ela também traz a integração com a Fase N).

**Pré-requisito de tudo abaixo:** pilha #62 a #83 mesclada na `main`. **Exceção vigente:** até esse merge, os pacotes partem de `rc-2-1-revisar-licoes` (PR #86) e o PR de cada um tem essa branch como base. A progressão com dispensa (N.24) já está nela.

| Pacote | Tarefas (na ordem) | Por que juntas | Notas |
|---|---|---|---|
| **P1. Trilha 0 completa** | RC.2.6, RC.3.4c, RC.4.1, RC.5.2 | RC.4.1 cria a lição que define Selic, CDI, TR e IPCA; a poupança (RC.5.2) usa TR e o widget `real-return`; os widgets de juros e inflação (3.4c) alimentam as duas | Primeira lição nova no meio da trilha: testar a dispensa (N.24) com progresso real. RC.2.6 é a limpeza do `Lesson/index.tsx`, que este pacote já toca |
| **P2. Trilha 1: Selic, Copom e reserva** | RC.5.3, RC.5.4, RC.4.6 | Mesmo trecho (1.1 a 1.3 e a reserva logo após a 1.2); Copom usa `copom-timeline` e `selic-ipca-chart` do P1; a reserva cumpre a promessa das lições 1.1/1.2 | Widgets `emergency-fund-calculator` e `where-to-keep` (parte da RC.3.4i) nascem aqui |
| **P3. Trilha 1: títulos, risco e crédito** | RC.3.4b, RC.3.4d, RC.5.6, RC.5.7 | `mtm-seesaw`, `fgc-coverage-bar`, `rating-ruler`, `bond-price-calculator`, `ipca-plus-simulator` e `breakeven-inflation` são consumidos só pelas lições 1.7 a 1.11 | Aproveitar para pôr o `fgc-coverage-bar` na 1.4 (ressalva (b) da RC.5.5) |
| **P4. Trilha 2: abertura (bolsa e ações)** | RC.4.2, RC.3.4e, RC.5.9, RC.4.3 | Lição "B3, corretora e ordens" e a reordenação da trilha 2 mudam a mesma sequência (2.1 a 2.5); widgets `order-book`, `ticker-decoder` etc. | **Ligar o `STRICT` do lint de termos (RC.1.2)** aqui, porque ticker e ON/PN passam a ter lição definidora. Segunda inserção no meio da trilha: testar dispensa |
| **P5. Trilha 2: ler uma empresa** | RC.3.4f, RC.5.10 | As lições 2.6.1 a 2.6.6 (balanço, margens, ROE, múltiplos, endividamento, DY) e os widgets de balanço e múltiplos são um bloco só | Esforço G: pode dividir em 2 sessões, mas é um PR |
| **P6. Trilha 2: setores, ETFs e custos** | RC.5.12, RC.4.8 | 2.8 e 2.9 e a lição de custos (`fee-drag`, reaproveita `compound-growth` do P1) falam de ETF, taxa e carteira | RC.4.8 depende de RC.4.2 e 2.9 |
| **P7. Calendário "Para você"** | RC.6.1, RC.6.2, RC.6.3, RC.6.4, RC.6.5 | Trilha B inteira, ponta a ponta (engine, backend, frontend, decisões) | **Independente do conteúdo**: pode rodar em paralelo a qualquer pacote. Rascunho de layout antes da RC.6.4 |
| **P8. Calendário: escalonamento, base e balanço** | RC.6.5b, RC.6.6, RC.6.7, RC.6.8 | Calibração, pacote puro `paymentschedule`, migrations aditivas e balanço escalonado são a fundação do motor | Só `engine/`; migrations aditivas, validar com `docker compose up`. Após P7 para a UI refletir |
| **P9. Calendário: escalonamento, proventos** | RC.6.9, RC.6.10, RC.6.11 | Proventos de ações por política, FIIs no mês real e snapshot na data ex dependem do P8 e entre si | Cria o fato novo que as lições de proventos (P10) precisam |
| **P10. Trilha 2: proventos, FIIs e imposto** | RC.3.4g, RC.5.11, RC.5.13, RC.4.7 | Lições 2.7 e 2.10 só podem descrever o calendário depois do P9; imposto de renda variável (RC.4.7) fecha o bloco; `dividend-timeline`, `fii-monthly-calendar`, `equity-tax-calculator`, `tax-decision-tree` | Os blocos "Na plataforma" desse pacote dependem do que o P9 entregou |
| **P11. Trilha F: finanças do dia a dia** | RC.4.4, RC.4.5 | Trilha nova (D13), paralela, sem desbloqueio de ativo: orçamento e dívida, com `budget-split`, `debt-snowball`, `pay-or-invest` | RC.4.5 depende de RC.4.1 (P1). Mapa e hub de trilhas ganham a trilha nova nos 3 breakpoints |
| **P12. Trilha 3: planejamento** | RC.3.4h, RC.5.8, RC.4.9 | Reescrita da trilha 3 (D12), widgets de risco e alocação e a lição de vieses antes do desafio final | Depois de P3 a P6 para os exemplos reusarem os widgets |
| **P13. Portfólio e Mercado Ao Vivo** | RC.7.3, RC.7.4, RC.7.5 | Donut interativo, cards Ao Vivo/Sandbox e composição desktop são a mesma tela (`pages/Portfolio`) | **Independente do conteúdo**: pode rodar em paralelo. Seguir D5/D6/D7 |
| **P14. Fechamento** | RC.5.14, RC.7.6, RC.8.1, RC.8.2 | Alinhar as taxas citadas ao catálogo, varredura visual com o app logado, auditoria final do conteúdo (43 lições) e documentação de referência | Só depois de todos os pacotes de conteúdo e de UI |
| **P15. Editor do painel** (bloqueado) | RC.3.6 | Compatibilidade do contrato `blocks` com o editor | Só quando a N.23 for implementada |

**Opcional, fora dos pacotes:** RC.6.12 (ETFs e evento macro por empresa), só se o autor pedir.

**Ordem sugerida de merge:** P1, P2, P3, P4, P5, P6 (conteúdo, nessa ordem) em paralelo com **P7 e P13** (UI sem
dependência de conteúdo); depois P8, P9, P10; então P11 e P12; **P14 por último**. P15 quando a N.23 existir.

**Resumo:** 49 sessões restantes viram **15 PRs** (14 mais o bloqueado), 3 deles independentes e livres para
paralelizar (P7, P13 e, no motor, o P8 após o P7).

---

## Rastreabilidade: pedidos do autor -> tarefas

| # | Pedido | Tarefas |
|---|---|---|
| 1 | Selic e CDI citados sem terem sido apresentados | RC.1.2, RC.3.5, RC.4.1, RC.5.2 |
| 2 | Poupança incompleta (duas regras) e TR sem explicação | RC.5.2, RC.1.3, RC.4.1 |
| 3 | "spec do TCC" visível; varrer o resto | RC.1.1, RC.1.4, RC.1.6 |
| 4 | Grade do mapa curta e "Você está aqui" sob um nó (web e mobile) | RC.7.1 |
| 5 | Popup com valor no donut de Distribuição | RC.7.2, RC.7.3 |
| 6 | Cards Mercado Ao Vivo e Sandbox levam à mesma tela; revisar o destaque do Sandbox | RC.7.4, D5, D7 |
| 7 | Copom "a cada 21 dias simulados" e outros dados irreais; real x plataforma | RC.5.4, RC.3.3, RC.1.1, RC.1.3, RC.5.14 |
| 8 | Lições que falam da plataforma em vez do mundo real | RC.3.3, Fase 5 inteira, RC.1.1 |
| 9 | Termos usados antes de apresentados | RC.1.2, RC.3.5, RC.4.1-RC.4.3 |
| 10 | Telas vazias: gráficos, tabelas, contas com input, gangorra | RC.3.1, RC.3.4a-h |
| 11 | Conteúdo superficial (FGC R$ 250 mil / R$ 1 milhão), mais perguntas, errar não avança | RC.5.*, RC.3.2, RC.2.3, RC.2.4 |
| 12 | Não consegue rever lições concluídas | RC.2.1 |
| 13 | Botão voltar dentro da lição | RC.2.2 |
| 14 | Dividendos no mesmo dia para todas as empresas e FIIs | RC.6.6-RC.6.12 |
| 15 | Calendário com eventos que não afetam o usuário; UI diferente para o que afeta | RC.6.1-RC.6.5 |
| 16 | Taxa bruta equivalente confusa e botão "Ver resultado"; plataforma deve fazer a conta | RC.3.4a, RC.5.5, RC.2.4 |
| 17 | Card "Complete a lição" com tamanhos diferentes | RC.2.5 |
| 18 | Revisar as 35 tarefas com pesquisa web, margem para adicionar | RC.1.3, **RC.1.7**, Fase 5, Fase 4, RC.8.1 |
| 20 | Ampliar o currículo (orçamento, dívida, reserva, imposto, custos, vieses) | RC.4.0, RC.4.4-RC.4.9 |
| 19 | Lições mais engajadas e visuais, mas leves, sem textão, ensinando o Brasil real | Objetivo, Princípio 0, RC.1.1 (teto de tamanho), Fase 3, Fase 5 |
