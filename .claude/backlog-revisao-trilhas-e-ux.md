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

### RC.2.2 · Botão Voltar (P.2)

- **Escopo:** reducer de navegação (`useLessonNavigation`), Voltar entre cartões e fases (exceto o primeiro
  cartão do Cenário), preserva escolha, veredito e revelações; reavançar fases já vistas não chama o POST (sem 422
  por intervalo de 5 s ou passo fora de ordem); teclado e leitor de tela.
- **Aceite:** voltar e reavançar em qualquer ponto sem erro nem espera; estado preservado.
- **Depende de:** RC.2.1.

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

### RC.2.4 · Frontend da pergunta (P.4)

- **Escopo:** botão Responder, erro desativa a alternativa escolhida (sem dicas), travar após acerto, "acertou de primeira"/"na Nª
  tentativa", revisão stateless, adaptar `useAdvanceLesson`/serviços, atualizar `backend/test/e2e/support/lessons.ts`
  (senão `equityOrderJourney` e `fixedIncomeRedemptionJourney` quebram) e criar `lessonJourney.e2e.test.ts`.
  `aria-invalid`, `role=alert`, foco.
- **Aceite:** errar nunca avança; tentativas ilimitadas; jornadas e2e existentes verdes.
- **Depende de:** RC.2.2, RC.2.3.

### RC.2.5 · `LockedGate` unificado (P.5)

- **Escopo:** rascunho/mockup primeiro. Componente único com variantes `screen`, `section`, `inline`, mesmo
  tamanho e estilo por variante, cadeado inequívoco, textos sem código de lição, claro/escuro, 3 breakpoints.
  Migra `LockedScreen`, `AssetDetail:91`, `FixedIncomeDetail:71`, `OrderConfirmationDialog:155` e remove
  `LockedAssetPanel`. Respeita a regra de CTA que nunca aponta para lição ainda não alcançada (Fase N do backlog de
  engajamento).
- **Aceite:** o card tem a mesma largura/altura relativa em todas as telas da mesma variante.
- **Depende de:** nada (paralelizável).

### RC.2.6 · Limpeza de comentários e tipos obsoletos

- `pages/Lesson/index.tsx:33-38` e `domain/lesson.ts:24-27` citam um checkbox "já pensei" que não existe. Corrigir
  na primeira tarefa que tocar nesses arquivos.

---

## Fase 3: Infraestrutura de conteúdo visual

### RC.3.1 · Contrato `blocks` e registro de widgets (P.6)

- **Escopo:** coluna `blocks` jsonb aditiva com fallback ao texto legado; registro de widgets no frontend com Zod
  por widget; `WidgetBoundary` (erro num widget não derruba a lição); `aria-live` e resumo textual por widget;
  `prefers-reduced-motion`; layout desktop em duas colunas (rascunho antes); bloco `callout`; migração dos 4
  widgets existentes (`growth_calculator`, `fixed_income_comparison`, painéis de indicador) para o registro.
- **Aceite:** lição sem `blocks` renderiza igual a hoje; `blocks` inválido cai no legado; contrato testado no
  front e no back.
- **Depende de:** RC.2.2. **Entrega antes do editor da N.23** (o editor já nasce sobre o contrato).

### RC.3.2 · Pergunta intermediária como bloco

- **Escopo:** bloco `checkpoint` (single, V/F, numérica com tolerância) com explicação mostrada após o acerto, erro desativa a alternativa escolhida
  (sem dicas) e tentativas ilimitadas; contagem de acertos de primeira por lição; reaproveita o endpoint de RC.2.3.
- **Aceite:** 3 a 7 checkpoints por lição suportados sem mudar o XP total (D1); progresso salvo ao sair e voltar.
- **Depende de:** RC.2.3, RC.3.1.

### RC.3.3 · Bloco "Na plataforma"

- **Escopo:** componente `PlatformNote` com *No Brasil / Aqui / Por quê*, visual distinto (selo, cor de token),
  aceito pelo teste RC.1.1 como único lugar permitido para a palavra "plataforma".
- **Aceite:** usado nas lições que divergem do real (Copom, Selic simulada, calendário, catálogo fictício).
- **Depende de:** RC.3.1.

### RC.3.4 · Biblioteca de widgets (agrupada em sessões)

Cada widget: Zod das props, `summary` textual, `aria-live`, responsivo, teste table-driven da fórmula. Detalhe de
entradas, saídas e fórmulas em `audit-licoes-*.md` e `analise-player-licao.md` §5.

| Sessão | Widgets | Lições que consomem |
|---|---|---|
| RC.3.4a Cálculo de renda fixa | `equivalent-rate` (taxa bruta equivalente, presets 60/720 dias), `ir-regressive-table`, `product-comparator` (líquido vs bruto, breakeven) | 1.4, 1.5, 1.6, 3.3 |
| RC.3.4b Risco e proteção | `mtm-seesaw` (gangorra de marcação a mercado: taxa x preço, prazo, Prefixado/IPCA+/Selic, choques), `fgc-coverage-bar` (R$ 250 mil por conglomerado, teto R$ 1 milhão em 4 anos, guarda-chuva), `rating-ruler` | 1.4, 1.8, 1.11 |
| RC.3.4c Juros e inflação | `compound-growth` (substitui `growth_calculator`), `real-return`, `selic-ipca-chart` (série com faixa da meta), `copom-timeline` (8 reuniões/ano) | 0.2-0.5, 1.2, 1.3, 1.9, 1.10 |
| RC.3.4d Títulos | `bond-price-calculator` (preço/deságio, IR e custódia, LTN x NTN-F), `ipca-plus-simulator` (VNA, ano a ano), `breakeven-inflation` | 1.7, 1.10 |
| RC.3.4e Ações, parte 1 | `ownership-calculator`, `bookbuilding-simulator`, `ticker-decoder` (arrastar), `headline-triage`, `order-book` (livro de ofertas interativo; G) | 2.1-2.5 |
| RC.3.4f Ações, parte 2 | `interactive-balance` (DRE em cascata + Ativo = Passivo + PL; G), `margin-comparator`, `roe-lab` (DuPont), `multiples-calculator`, `debt-thermometer` (choque de Selic) | 2.6.1-2.6.5 |
| RC.3.4g Proventos e fundos | `dividend-timeline` (data com, ex, pagamento), `dividend-net-calculator` (dividendo/JCP líquido, regra de 2026), `etf-shock-simulator`, `fii-monthly-calendar` | 2.6.6, 2.7, 2.9, 2.10 |
| RC.3.4i Vida real | `budget-split`, `debt-snowball`, `pay-or-invest`, `emergency-fund-calculator`, `where-to-keep`, `equity-tax-calculator`, `tax-decision-tree`, `fee-drag`, `behavior-bias-quiz` | RC.4.4 a RC.4.9 |
| RC.3.4h Planejamento | `risk-return-scatter`, `allocation-donut`, `risk-profile-quiz` | 3.1, 3.2, 3.4 |

- **Aceite geral:** nenhum texto manda calcular fora; nenhum botão "Ver resultado" solto (se sobrar, rótulo
  contextual); lint do seed barra "calcule" sem widget na mesma fase.
- **Depende de:** RC.3.1 (e RC.3.2 quando o widget traz checkpoint).

### RC.3.5 · Glossário ampliado e dicas inline

- **Escopo:** glossário estruturado (hoje 6 termos) com cerca de 40 termos, cada um com a lição de origem,
  definição curta, exemplo; tooltip/toque no primeiro uso do termo em cada lição; página de glossário (consulta).
  Inclui Selic, CDI, TR, IPCA, ticker, ON/PN, valor de face, VNA, alavancagem, payout, JCP, ITR/DFP, valor de
  mercado, NAV, ágio/deságio, spread, liquidez, duration, conglomerado financeiro, securitizadora.
- **Aceite:** RC.1.2 sem avisos; glossário acessível em todos os breakpoints.
- **Depende de:** RC.3.1.

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

### RC.4.1 · Nova lição "Juros, Selic, CDI e TR" (antes da 0.5)

- Define Selic (meta x efetiva), CDI (taxa entre bancos, ~Selic), TR (o que é, por que existe, hoje ~zero) e o
  papel do IPCA; dá o grafo `0.4 -> nova -> 0.5`. Ver `audit-licoes-0-3.md`.
- **Aceite:** RC.1.2 sem Selic/CDI/TR usados antes; lição passa nos checkpoints; quem estava na 0.5 não é
  bloqueado nem perde progresso.
- **Depende de:** RC.3.1, RC.3.2, RC.3.5, RC.1.3.

### RC.4.2 · Nova lição "B3, corretora e ordens"

- Cobre o que as ações cobram sem ensinar: corretora, B3, ordem a mercado x limite, spread, liquidez, horário,
  lote e fracionário (sufixo F), custos e IR de venda de ações (isenção de R$ 20 mil/mês), posicionada antes da 2.5.
- **Depende de:** RC.3.4e, RC.1.3, D11.

### RC.4.3 · Reordenação da trilha 2

- Ordem proposta pelo agente: 2.1, 2.3, 2.2, nova B3/ordens, 2.5, 2.4, 2.6.1, 2.6.2, 2.6.5, 2.6.3, 2.6.4, 2.7, DY
  (2.6.6 depois da 2.7, porque dividendos precedem DY). Mover IPCA antes da 1.3 (ou definir inline).
- **Aceite:** mudar `unlocks`/ordem sem alterar `stableKey`; migração de dados com N.24; e2e de progressão
  percorre a trilha inteira.
- **Depende de:** RC.4.1, RC.4.2, N.24 (já feita).

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
| RC.4.4 | **Orçamento**, "Para onde vai seu dinheiro" (N1): renda menos gastos, fixos/variáveis/eventuais, regra de bolso 50/30/20, pague-se primeiro | início da Trilha F ou logo após a 0.1 (D13) | `budget-split` (sliders de categoria, sobra em R$ e %, comparação com 50/30/20) | M | Caderno de Educação Financeira do Banco Central; a 50/30/20 é rotulada como regra de bolso popular se não constar na fonte oficial |
| RC.4.5 | **Dívida e crédito** (N2): juros compostos contra você, rotativo do cartão, cheque especial, consignado, dívida cara primeiro, renegociação | Trilha F ou Trilha 0 após RC.4.1 (D13) | `debt-snowball` (saldo, taxa a.m., pagamento; meses para quitar e juros totais; efeito do pagamento mínimo), `pay-or-invest` | M | Lei 14.690/2023 (juros do rotativo limitados ao valor original); teto do consignado vigente (exemplo datado); programa de renegociação vigente; taxas médias do Banco Central; dependem de RC.4.1 |
| RC.4.6 | **Reserva de emergência** (N4): quanto e onde. Cumpre a promessa das lições 1.1 e 1.2, que falam em "montar uma reserva de emergência de verdade" e nenhuma lição ensina | Trilha 1, logo após a 1.2 | `emergency-fund-calculator`, `where-to-keep` (arrastar produto para "serve" ou "não serve") | M | faixas de 3 a 6 meses (CLT) e 6 a 12 (autônomo): só gravar com texto oficial, senão rotular regra de bolso; Tesouro Reserva só se existir e estiver verificado |
| RC.4.7 | **Imposto em renda variável** (N5): swing 15%, day trade 20%, isenção de R$ 20 mil/mês só para ações, DARF, "dedo-duro", declaração no IR, dividendos | Trilha 2, após a 2.10 | `equity-tax-calculator`, `tax-decision-tree` | M | B3/Receita (alíquotas, isenção, retenção 0,005% e 1%); desfecho da MP 1.303/2025 (caducou) em fonte oficial; Lei 15.270/2025 (10% sobre dividendos acima de R$ 50 mil/mês por fonte pagadora) no Planalto; depende de RC.4.2 |
| RC.4.8 | **Custos de investir** (N6): corretagem, custódia, taxa de administração, gestão e performance, spread, o efeito de 2% ao ano em 20 anos | Trilha 2, após RC.4.2 e 2.9 | `fee-drag` (duas curvas e a diferença em R$ e %, reaproveita `compound-growth`) | P/M | definições de taxa de administração, gestão e performance (Portal do Investidor/CVM); custódia do Tesouro e corretagem vigentes; depende de RC.3.4c |
| RC.4.9 | **Vieses e emoção** (N14): aversão à perda, efeito manada, excesso de confiança, regras prévias | Trilha 3, antes do desafio final | `behavior-bias-quiz` (cenários curtos, o viés e o custo simulado, usando uma queda de evento macro do jogo como caso) | M | nenhum número; achar o material de finanças comportamentais do Portal do Investidor antes de citar |

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
| RC.5.1 | 0.1-0.4 | tirar "TCC cap. 2.1.1" da 0.2; "regime composto" impreciso; "indicador nesta plataforma é nominal" (0.4) vira Na plataforma; IPCA definido ou movido | M |
| RC.5.2 | 0.5 (poupança) | duas regras (Selic acima de 8,5%: 0,5% a.m. + TR; igual ou abaixo: 70% da Selic + TR), TR explicada, "sempre atrás" falso: comparação líquida; widget `real-return` | G |
| RC.5.3 | 1.1, 1.2 | PU do Tesouro Selic sobe todo dia, a Selic muda a velocidade (pergunta corrigida); IOF 29 dias, custódia B3, IR; remover "spec do TCC" | M + G |
| RC.5.4 | 1.3 (Copom) | 8 reuniões/ano de 2 dias, ~45 dias (nunca "21 dias simulados"); meta de inflação 3% ±1,5; meta x efetiva; Taylor vira Na plataforma; gangorra inflação x Selic; gráfico Selic x IPCA | G |
| RC.5.5 | 1.4-1.6 | FGC completo (conglomerado, R$ 1 milhão em 4 anos, o que não cobre, sem "tão seguro quanto o Tesouro"); CDI com exemplo coerente (% do CDI); IR com IOF e retenção, isenção só PF; LCI/LCA com carência real e `equivalent-rate`; remover `[revelar]` | G |
| RC.5.6 | 1.7-1.8 | Prefixado: R$ 199,24 é bruto, LTN x NTN-F, vencimento coerente; marcação a mercado com gangorra e duration, vale também para IPCA+, Copom x taxa de mercado do título; remover "Copom simulado a cada 21 dias reais" e "Sandbox" | M + G |
| RC.5.7 | 1.9-1.11 | IPCA: cesta e abrangência reais, meta 3% ±1,5, números atuais verificados; IPCA+: marcação a mercado, IR sobre o ganho nominal, VNA e defasagem, taxa realista; CRI/CRA: não vendê-los como reserva de emergência, risco nos devedores e garantias (patrimônio separado), FGC não cobre, isenção e risco regulatório | M-G + G + G |
| RC.5.8 | 3.1-3.4 | trilha 3 vira planejamento real: diversificação, perfil de investidor real (conservador/moderado/arrojado, questionário de suitability; "Sofisticado" removido), comparação de produtos líquida (252 dias úteis, CDI explícito), desafio final; prática no simulador como etapa separada e rotulada; 3.4 sem "evento real" para evento simulado (D12) | G x4 |
| RC.5.9 | 2.1-2.5 | IPO com oferta secundária, follow-on e bookbuilding; ticker/ON/PN/sufixos (5 a 8, BDR 32-35, F) ensinados antes de cobrados; notícias e oferta e demanda sem "motor/feed/painel"; livro de ofertas interativo | G |
| RC.5.10 | 2.6.1-2.6.6 | PL é valor contábil; EBIT x lucro líquido; ROE com alavancagem e DuPont; endividamento: Dívida Líquida/EBIT não se aplica a banco (a lição afirma o contrário); a promessa do "painel ao vivo" dos 6 números base precisa de painel real ou sai do texto; DY com imposto de 2026; "9 indicadores do currículo" fora | G |
| RC.5.11 | 2.7 | data com x data ex x pagamento corretas (hoje troca data ex por data com); periodicidade real, JCP (15% na fonte), payout mínimo de 25%, Lei 15.270/2025; ações e FIIs não são iguais; "14 dias simulados" removido (o motor usa 91); Na plataforma explicando o calendário | G |
| RC.5.12 | 2.8, 2.9 | setores: cíclico/defensivo/alavancado definidos; gabarito do banco com Selic alta não segue a regra interna do motor (bancos tendem a ganhar com spread); ETF: maioria reinveste, IR 15% sem a isenção de R$ 20 mil, NAV/ágio/participante autorizado preparados, "deságio" sem colidir com o glossário, peso do banco no SINT11 coerente com o seed (35% x 20%) | M-G + G |
| RC.5.13 | 2.10 | FII: distribuição mensal (mínimo 95% do resultado semestral), isenção de IR para PF (requisitos), 20% sobre ganho de capital, P/VP, papel indexado a IPCA, "dividendo" x "rendimento", frase quebrada na revelação e `unlocksDescription` com erro ("com onde crescer") | G |
| RC.5.14 | Todas | taxas citadas (CDB 12%, LCI 9,5%, LTN 11,75%, NTN-B 6%) alinhadas ao catálogo (% do CDI e spreads) ou apresentadas como exemplo didático explícito | M |

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

- **RC.6.1 Relevância no engine (B.1):** `Event` ganha `relevance` (mine/market), `relevance_reason`,
  `estimated_amount`, `amount_is_estimate`, `user_quantity`; `summary` por dia; `scope`/`market_limit`; valor
  exato de provento a partir de `dividend_event_recipients` quando a data ex já passou, estimativa antes. Sem dado
  de terceiros (RNF09). `.docs/engine/calendar.md`.
- **RC.6.2 Backend (B.2):** `marketCalendarQuerySchema` (`scope`, `market_limit`), port/tipos, router e caso de
  uso testados; `user_id` na query ignorado; `.docs/backend/market.md`.
- **RC.6.3 Frontend: dados (B.3):** tipos, função pura `calendarRelevance`, segmented control Meus/Todos
  persistido.
- **RC.6.4 Frontend: UI (B.4):** rascunho antes. Faixa "Para você" em destaque (sólido para exato, tracejado para
  estimado, convenção do `identidade-visual-padroes.md`), "No mercado" recolhível e secundário, marcador duplo na
  faixa de dias e na grade, relevância nunca só por cor, estados vazios, 3 breakpoints.
- **RC.6.5 Decisões e docs (B.5):** registrar JCP, instante do snapshot e Copom como "mine" em
  `pontos-em-aberto-decisao-produto.md` (D9, D10).

### Trilha A: escalonamento por ativo (D8, decidido: entra no escopo)

| Tarefa | Conteúdo | Depende de |
|---|---|---|
| RC.6.5b | **Calibração com referência real** (antes de codificar): pesquisar em fonte primária (B3, CVM, RI de emissoras, regulamentos de FII) a periodicidade de dividendos/JCP por setor, janela real de divulgação de ITR/DFP, e dia de pagamento de FIIs; registrar parâmetros e fonte em `.claude/calibracao-calendario-proventos.md` no molde de `calibracao-fundamentos-setor.md` | nada |
| RC.6.6 (A.1) | pacote puro `paymentschedule`: offset por ativo (chave estável: ticker, não UUID), políticas trimestral/semestral/anual, FII no mês-calendário real, pagamento em dia útil; offset 0 reproduz o legado | RC.6.5b |
| RC.6.7 (A.2) | migrations aditivas (`companies.report_offset_days`, `dividend_policy`, `fii_details.payout_*`, `dividend_events.declared_day/ex_day/recipients_snapshotted`, `schedule_cutover_day`); defaults reproduzem o legado; seed e `CreateCompany` usam `DefaultsFor` | RC.6.6 |
| RC.6.8 (A.3) | balanço escalonado em `Advance`, ajustando os acoplamentos (macroevento de fundamentos `AssignReportDay`, banda de preço do provento, `cycleIndex` do ruído, `MaxWindowDays`) | RC.6.7 |
| RC.6.9 (A.4) | proventos de ação por política, pool acumulado no semestral, efeito de preço ancorado na data ex | RC.6.8 |
| RC.6.10 (A.5) | FIIs no mês real com offset por fundo (5º a 15º dia útil), 12 pagamentos/ano, DY anual-alvo preservado | RC.6.6, RC.6.7 |
| RC.6.11 (A.6) | declaração separada e snapshot na data ex; `ListDividendPayerAssets` sem carregar holders de todo ativo todo tick; benchmark em catálogo sintético | RC.6.9, RC.6.10 |
| RC.6.12 (A.7/A.8, opcional) | ETFs e evento macro por empresa | RC.6.8 |

- **Regras:** `market_events` e `dividend_events` já pagos ficam intactos (event sourcing); cutover por dia de
  corte; validar em catálogo sintético com 1.000 ativos (projetar para o crescimento, não para os 35 de hoje);
  determinismo e testes table-driven; medir o tick.

---

## Fase 7: Mapa da Trilha, Portfólio e Sandbox

Fonte: `analise-mapa-portfolio-sandbox.md`.

| Tarefa | Escopo | Aceite |
|---|---|---|
| RC.7.1 ✅ | **Marcador "Você está aqui" e grade do mapa (T1).** Etiqueta como filha do `.nodeWrap` do nó atual (`TrackPath/index.tsx:110-114`, `index.module.css:225-244`), centrada acima do círculo, com z-index; grade em CSS no `.canvas` com token `--grid-line` para claro e escuro (hoje `rgba(255,255,255,0.035)` fixo, invisível no tema claro), `preserveAspectRatio="none"` removido; atualizar `identidade-visual-tokens.md`; checar também a dica `.hint` e a bandeira expandida | em 360/768/1280px a etiqueta nunca intersecta nó ou título; grade cobre o canvas inteiro em trilhas de 2, 4 e 15 lições, nos dois temas; testes RTL e `getBoundingClientRect` |
| RC.7.2 ✅ | **Dados do donut (T2, mecânico).** Filtrar `isSandbox` (SAND3 entra hoje), base `markPrice ?? averagePrice` (D6) | soma das fatias igual ao `liveInvested` do card; nenhum ticker de Sandbox |
| RC.7.3 | **Donut interativo com R$ (T3).** Arcos em SVG (hoje um `conic-gradient` em `role="img"`), tooltip em hover (desktop) e toque/clique (mobile), foco por teclado (Tab, Enter, setas, Esc), furo mostra o total por padrão, legenda com R$ e %, `aria-label` por fatia, sem lib nova | informação nunca só em hover; R$ e % corretos; 3 breakpoints |
| RC.7.4 | **Cards Mercado Ao Vivo e Sandbox (T4).** Implementar a opção decidida em D5 (recomendada B: faixa compacta que só aparece com posição Sandbox, destinos distintos, ex. `/extrato?escopo=aprendizado`); estado vazio sem "R$ 0,00" gigante; se mudar, atualizar spec 3.1, inventário 2.1 e RF12 | com e sem posição Sandbox; tela mais curta em mobile; decisão registrada |
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
tarefa sem ✅ na ordem da "Sequência sugerida"** abaixo, respeitando "Depende de" (se a primeira candidata estiver
bloqueada por tarefa não concluída, pegar a primeira desbloqueada e dizer isso). Tarefas que a sequência marca "em
paralelo" são uma por vez, salvo pedido do autor.

**Passo a passo de cada sessão:**
1. Ler este arquivo (Objetivo, Princípios, a tarefa, suas dependências e decisões D#) e o anexo de
   `.claude/revisao-trilhas-anexos/` citado nela. Não redecidir o que está marcado DECIDIDO.
2. Branch nova a partir da `main` atualizada: `rc-<número>-<tema>` (ex.: `rc-1-1-teste-conteudo-proibido`). Se
   depender de tarefa ainda não mesclada, partir da branch dela e dizer isso ao autor.
3. Implementar só essa tarefa, um commit por tarefa, seguindo o checklist do `CLAUDE.md` da camada tocada (testes junto,
   lint/build, `.docs/` se mexer em rota, validação em `docker compose up`). Telas novas nos 3 breakpoints; sem
   travessão como pontuação em texto de UI; mudança de padrão visual pede rascunho antes.
4. Tarefa de conteúdo: seguir a regra de entrada da Fase 5 (validação RC.1.7, fonte primária pesquisada na web,
   fato registrado em RC.1.3 antes do texto) e o Princípio 0 (leve, cartões curtos).
5. Verificar os critérios de aceite. Ao concluir, marcar ✅ no título da tarefa e acrescentar um bullet
   **Entregável** (o que foi feito, arquivos principais, como validou). Atualizar o `backlog-pendencias-consolidado.md`.
6. Se achar gap que exige decisão de produto fora deste arquivo, registrar em `pontos-em-aberto-decisao-produto.md`.
7. Fim: `git push`; abrir PR só se o autor pedir. Resumir ao autor o que foi feito, o que validou e qual é a próxima
   tarefa da sequência.

---

## Sequência sugerida

1. **Fase 1** inteira (RC.1.1, RC.1.3 e RC.1.5 em paralelo; depois **RC.1.7, a validação das 35 lições, que bloqueia a Fase 5**, RC.1.4, RC.1.2 em modo aviso, RC.1.6): corrige
   o que o autor marcou como inaceitável (TCC visível) e instala a rede de proteção.
2. **RC.7.2, RC.7.1** (correções mecânicas e visuais pequenas, independentes) e **RC.2.5** em paralelo.
3. **RC.2.1, RC.2.3** (paralelos), depois **RC.2.2, RC.2.4**: rever lições, voltar, errar não avança.
4. **RC.3.1, RC.3.2, RC.3.3, RC.3.5**: infraestrutura de conteúdo.
5. **RC.3.4a** + **RC.5.5** (corrige a lição 1.6 e o "Ver resultado", o ponto mais criticado).
6. **RC.4.1** + **RC.5.1-RC.5.4** (trilhas 0 e início da 1, incluindo poupança e Copom).
7. **RC.3.4b-d** + **RC.5.6-RC.5.7**, depois **RC.4.2-RC.4.3** + **RC.3.4e-g** + **RC.5.9-RC.5.13**, depois
   **RC.3.4h** + **RC.5.8**, e **RC.5.14** ao final.
8. **RC.4.0** já entregue (mapa); escolher posição (D13) e fazer **RC.4.6** (reserva, cumpre promessa da 1.1/1.2) junto de RC.4.1; **RC.4.4, RC.4.5** depois; **RC.4.7, RC.4.8** após RC.4.2; **RC.4.9** na trilha 3.
9. **Fase 6, Trilha B** (RC.6.1 a RC.6.5), podendo rodar em paralelo a qualquer passo a partir do 2;
   **Trilha A** depois, após D8.
10. **RC.7.3 a RC.7.6** conforme D5/D6/D7.
11. **Fase 8.**
12. **RC.3.6** quando a N.23 for implementada.

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
