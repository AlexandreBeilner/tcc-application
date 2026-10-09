# Análise do player de lição (6 pedidos do autor)

Somente leitura. Branch `fase-n-pr8-usuarios`. Caminhos relativos à raiz do repo. Última migration: `0020` (journal `when` 1791200000000; a próxima precisa de `when` maior, ver memória "Drizzle journal when must increase").

## 0. Mapa do que existe hoje

- Player: `frontend/src/pages/Lesson/index.tsx` (419 linhas). Máquina de 4 fases (`TOTAL_STEPS = 4`, :25): 0 Cenário, 1 Micro-decisão, 2 Revelação, 3 Desbloqueio. Dentro de cada fase, o texto é fatiado em cartões por `\n\n` (`features/lessons/splitIntoCards/index.ts:154`), com prefixo `[revelar] ` para cartão escondido (:152). O sub-passo (`subStep`, :84) e os cartões revelados (`revealedIndexes`, :89) são estado local, não persistido.
- Persistência: só o passo de fase (`user_lesson_progress.current_step`, `backend/src/db/schema.ts:207-242`). `POST /lessons/:id/progress` (`backend/src/modules/lessons/interfaces/http/lessonsRouter.ts:431`) chama `AdvanceLessonUseCase` (`application/useCases/advanceLesson.ts`).
- Seed: `backend/src/db/seedLessons.ts`, 1506 linhas, 35 lições. Formato: `scenarioText`, `microDecisionPrompt`, `revelationText` (strings com `\n\n`, `[revelar] `, `{{Termo}}`, `{{ref:X.Y}}`), `microDecisionType` (enum), `microDecisionOptions: string[]|null`, `microDecisionCorrectOption: number|null` (a coluna existe, mas nunca sai por `GET`, ver `domain/lesson.ts:164-177`). Distribuição: 25 `reflection`, 6 `live_indicator`, 2 `live_macro_indicator`, 1 `growth_calculator` (0.2, seed:153), 1 `fixed_income_comparison` (3.3, seed:1372). 32 lições têm opções de aposta. O upsert (`seedLessons.ts:1456`) é `onConflictDoUpdate` por `stable_key` e sobrescreve todo o conteúdo.
- Widgets que existem: só 4 pontos de extensão, todos hardcoded no `if` de `pages/Lesson/index.tsx`:
  - `GrowthCalculatorForm` (:247) e `FixedIncomeComparisonForm` (:248), na Micro-decisão, reaproveitados das telas de Calculadora (`components/organisms/`).
  - `EquityIndicatorsPanel` (:304) para `live_indicator` e `IndicatorSummaryCards` (:312) para `live_macro_indicator`, ambos na Revelação.
  - O enum `microDecisionType` mistura "tipo de interação" com "widget de dados ao vivo", e o widget é uma função do enum, não do conteúdo.
- Componentes visuais reaproveitáveis (não-lição): `GrowthChart`, `GrowthProjectionTable`, `PriceChart`, `IndicatorLineChart`, `DistributionChart`, `CompanyFundamentalsChart`, `FiiIndicatorsPanel`.

## 1. Rever lição concluída (pedido 1)

Diagnóstico:
- `pages/Lesson/index.tsx:95`: `const step = localStep ?? lesson?.currentStep ?? 0`. Ao concluir, o backend grava `current_step = 3` (`advanceLesson.ts:154`, `completeIfNotAlreadyCompleted(..., input.step, ...)`), então `GET /lessons/:id` volta `currentStep: 3` e o player cai direto na fase Desbloqueio (:328). O comentário em :97-101 e o teste `Lesson/index.test.tsx:366-374` fixam isso como "modo revisão = jump pro Desbloqueio". É comportamento deliberado que o autor agora quer mudar.
- O backend já permite abrir lição concluída mesmo se a progressão atual não a sustentaria (`advanceLesson.ts:115-122`; `getLesson.ts` só barra `locked`, e `completed` tem prioridade em `lessonStatus`, `domain/lesson.ts:99`).
- Registro de revisão: `Lesson/index.tsx:104-109` chama `POST /lessons/:id/review` ao montar, sem o usuário ter lido nada. A missão "revise uma lição antiga" (H.2; `hasReviewedOldLessonToday.ts`, elegível após `REVIEW_ELIGIBLE_AFTER_DAYS = 14`, `domain/lesson.ts:279`) é cumprida só por abrir a página.

Riscos concretos (se o review reutilizar `POST /progress`):
1. `advanceLesson.ts:131-141`: para lição já concluída, `upsertProgress` sobrescreve `current_step` com o passo menor (conclusão não é perdida porque `completedAt` é preservado, mas `currentStep` regride; `LessonView.currentStep` e o `LessonNode` leem esse campo).
2. Pior: o mesmo `upsertProgress` regrava `microDecisionSelectedOption` se `selectedOption` for enviado. Esse campo alimenta `buildMicroDecisionAttemptsChronological` (`domain/lesson.ts:317`), `tracksCompletedWithoutErrors` (:379) e portanto conquistas `micro_decisions_streak`/`track_completed_no_errors` e a missão H.3. Uma revisão errada reescreveria o histórico de acertos.
3. XP/streak: já são idempotentes (`attemptingCompletion` exige `!alreadyCompleted`; `xpAwarder.award(..., 'licao:<id>')`; `completeIfNotAlreadyCompleted` com `wonRace`). Nenhum risco de reconceder XP hoje, mas é uma defesa que passa a ser exercida, então vale teste explícito.

Desenho:
- Modo revisão é 100% local no cliente: `const isReview = lesson.status === 'completed'`. Em revisão o player começa no passo 0 (`step` inicial = 0 ignorando `currentStep`), navega livremente entre fases e cartões e NUNCA chama `POST /progress`. A fase final de revisão exibe "Fim da revisão" com "Voltar pra Trilha", sem "Continuar" que dispare avanço. Selo "Revisando" no topo (badge) e mensagem "sem XP nesta volta".
- Backend endurece (defesa em profundidade): em `AdvanceLessonUseCase`, se `alreadyCompleted`, retornar sem escrever nada (`{ currentStep: own.currentStep, completed: true }`, mais o veredito se `selectedOption` veio). Manter o contrato de resposta. Ajustar os testes de `advanceLesson.test.ts` que hoje esperam o upsert em lição concluída.
- Registro da revisão: mover a chamada de `reviewLesson.mutate()` de "ao montar" para "ao alcançar a Revelação (fase 2) em modo revisão" (ou ao final). Mantém a verificação cruzada e evita farm por abrir/fechar. Decisão de produto simples e inócua; documentar no Entregável.
- Entrada pela trilha: `TrackMap` (`pages/TrackMap/index.tsx:52`) já navega `/trilha/:id` para qualquer status; o `LessonNode` de lição concluída deve ganhar rótulo "Rever" (acessibilidade: `aria-label="Rever lição X"`).
- Contrato: nenhuma mudança em `GET`. Opcional: expor `completedAt` em `LessonView` para exibir "concluída em ...". Não necessário.

## 2. Botão "Voltar" entre blocos (pedido 2)

Diagnóstico: `Lesson/index.tsx:226, 271, 321`: cada fase só tem `Button` "Continuar" (`ctaRow`); `subStep` só incrementa (`handleCardContinue`, :170-176). Não existe "voltar" nem entre cartões nem entre fases. O link `Sair da lição` (:190) leva à trilha.

Desenho:
- Reducer único de navegação no cliente (`features/lessons/useLessonNavigation`): estado `{ phase, card }`, ações `next`, `back`, `jumpTo`. `back` no card 0 de uma fase volta ao último cartão da fase anterior (se a fase anterior já foi vista). Em modo normal, não permitir voltar para a fase 0..2 além do que o servidor aceita? Voltar é só visual: o `current_step` do servidor nunca regride (a fase mais avançada já alcançada fica gravada; `assertStepAllowed` já aceita reenvio do mesmo passo). O botão "Continuar" ao voltar e reavançar não deve chamar o POST se `phase+1 <= maxPhaseReached` (evita `LessonStepTooFast`, 5 s, `advanceLesson.ts:230-235`, e 422 de "fora de ordem").
- Estado a manter ao voltar: `selectedOption`, `microDecisionResult` (veredito) e `revealedIndexes` por (fase, cartão) (hoje reseta, :161; trocar para `Set<string>` com chave `${phase}:${card}`).
- UI: botão `secondary` "Voltar" à esquerda da `ctaRow`, oculto no primeiro cartão do passo 0. `CardDots` passa a ser contador clicável opcional (não obrigatório). Atalhos de teclado: setas esquerda/direita quando o foco não está em input.
- Regra de aposta: voltar da Revelação para a Micro-decisão com aposta resolvida mostra a pergunta já respondida (travada, ver pedido 3), nunca permite trocar a resposta já aceita.

## 3. Perguntas intermediárias: errar não avança (pedido 3)

Como funciona hoje:
- Opções e aposta: `Lesson/index.tsx:250-266` renderiza botões `aria-pressed`; só habilita "Continuar" se `selectedOption !== undefined` (:119, :273). O índice vai junto do `POST /progress` que sai do passo 1 (`handleAdvance` :144-149, `step + 1` = 2). A validação é no SERVIDOR (`advanceLesson.ts:88-94` valida faixa; `microDecisionResultFor` em `domain/lesson.ts:223` compara com `microDecisionCorrectOption`). O veredito (`microDecisionCorrect`, `correctOptionLabel`) só vem na resposta desse POST (:152-158) e é mostrado na Revelação como badge "Você acertou"/"Quase. A resposta certa era: ..." (:285-290). Ou seja: errar AVANÇA e revela a resposta certa. Não há "tentativas".
- Lições sem opções (0.1) e as de widget embutido (0.2, 3.3) avançam sem aposta (:119). Não existe mais checkbox "já pensei" (os comentários em :33-38 e `domain/lesson.ts:24-27` estão desatualizados).
- Impacto em gamificação, todo derivado de `user_lesson_progress.micro_decision_selected_option` = última escolha enviada (`upsertProgress` aceita reenvio no mesmo passo, `assertStepAllowed` :225-229):
  - XP: fixo `LESSON_XP_REWARD = 50`, independente de acerto (`advanceLesson.ts:188-192`).
  - Conquistas `micro_decisions_streak`, `track_completed_no_errors` e missão H.3 "3 apostas seguidas" usam `isCorrectOption(lesson, selected)`; `tracksCompletedWithoutErrors` (:379) exige acerto em toda aposta real.
  - Se passarmos a exigir acerto para avançar, TODA lição concluída passaria a ter "acerto" e esses sinais virariam constantes verdadeiras. É a decisão-chave: o dado precisa passar a representar "acertou de primeira".

Desenho proposto (validação continua no servidor; a resposta certa nunca vai no `GET`):
- Novo endpoint `POST /lessons/:id/answer` body `{ selectedOption }` (Zod: int >= 0). Resposta: `{ correct: boolean, attempts: number, correctOptionLabel?: string, firstTry: boolean }`. O rótulo da resposta certa só é devolvido quando `correct = true` (errar não entrega o gabarito; evita que o botão "errar para ver a resposta" vire atalho). Lição sem aposta real: `422 no_micro_decision`.
- Regras no caso de uso novo `AnswerMicroDecisionUseCase` (+ porta no `LessonRepository`):
  - Só vale com `own.currentStep >= 1` (aluno já saiu do Cenário) ou lição concluída (revisão, stateless: nada é gravado, só devolve `correct`). Fora disso `422 step_out_of_order`.
  - Primeira tentativa: grava `microDecisionSelectedOption` = primeira escolha (imutável depois), `micro_decision_attempts = 1`. Nas seguintes: `attempts += 1` sem mexer na primeira escolha. Isso preserva a semântica atual de todas as conquistas/missões ("acerto de primeira") e os dados históricos (linhas antigas já guardam a escolha única).
  - Acerto: grava `micro_decision_solved_at = now()`.
  - Não toca em `updated_at` (senão reinicia o intervalo mínimo de 5 s do avanço, S.4); usar `UPDATE` específico e não `upsertProgress`.
  - Limite de taxa leve (ex.: 30 respostas/min por usuário) para não virar oráculo de força bruta; tentativas ilimitadas continuam, mas com atraso de UX opcional após 3 erros (apenas cliente: dica).
- Gate no avanço: em `AdvanceLessonUseCase`, ao ir do passo 1 para 2 em lição com aposta real e `own.microDecisionSolvedAt == null` e não concluída: `422 { code: 'micro_decision_unsolved' }`. Grandfathering: quem já está no passo >= 2 ou concluído não é afetado (o gate só dispara na transição 1->2). Quem está exatamente no passo 1 sem `solved_at` (usuários em andamento na hora do deploy) responde a pergunta uma vez; custo mínimo. `selectedOption` deixa de ser aceito em `/progress` (campo opcional deprecado e ignorado por 1 release, depois removido do Zod `schemas.ts:6-11`).
- Schema: `user_lesson_progress` ganha `micro_decision_attempts smallint not null default 0`, `micro_decision_solved_at timestamptz null`. Backfill na migration: para linhas com `micro_decision_selected_option is not null` e `current_step >= 2`, `micro_decision_solved_at = updated_at` e `attempts = 1` (já passaram). Linhas com `completed_at` também. Migration `0021` com `when` > 1791200000000.
- XP/gamificação: manter XP flat 50 (decisão de produto; não inventar bônus). Opcional e pequeno, mas exige decisão: badge "Acertou de primeira" vs "Acertou na 3a tentativa" apenas cosmético na Revelação. Registrar em `.claude/pontos-em-aberto-decisao-produto.md` se o autor quiser XP por acerto de primeira.
- Funil N.18 ganha dado novo: `attempts` e `% acerto de primeira` por lição.
- Formato do seed: sem mudança obrigatória para a aposta (`microDecisionOptions`/`CorrectOption` iguais). Mudança de conteúdo necessária: cada alternativa errada deve poder ter um `hint` (dica curta mostrada ao errar, sem entregar o gabarito). Contrato novo opcional `microDecisionHints: (string|null)[]` alinhado às opções (coluna `text[]` nullable). Sem hints, o cliente mostra a mensagem genérica "Não foi dessa vez. Releia o cenário e tente de novo" com link para voltar (pedido 2).
- Cliente: `selectedOption` vira "tentativa", botão "Responder" (não mais "Continuar" na última carta); errou: `role="alert"` + opção marcada `aria-invalid`, nenhuma opção bloqueada, foco volta para o grupo; acertou: opções travadas, mostra explicação curta (primeiro cartão da Revelação) e libera "Continuar". Verificar: não depender só de cor (ícone + texto), alvo de toque >= 44 px.
- Revisão (pedido 1): mesma UI usando `POST /answer` em modo stateless (completed), sem gravar nada.
- Alternativa descartada: validar no cliente (exigiria enviar o gabarito no `GET`; foi exatamente o vazamento corrigido na PR 18).

## 4. "Ver resultado" e a conta externa (pedido 4)

Mecanismo identificado: é a lição 1.6 "LCI e LCA", `seedLessons.ts:460-508` (`stableKey: '1.6'`, sortOrder 11).
- Não é aposta nem widget: o `revelationText` (:491-507) pede, em prosa, "calcule a taxa bruta equivalente ... taxa isenta dividida por (1 menos a alíquota)" (:494-495) e depois dois cartões com prefixo `[revelar] ` (:497, :500) que são renderizados por `CardBody` (`Lesson/index.tsx:360-368`) como botão "Ver resultado" (:361-367). O botão não diz o que vai revelar, não há inputs, e o aluno tem que calcular fora (ou simplesmente clicar).
- É o recurso de "revelação progressiva" (tarefa A.3, `splitIntoCards/index.ts:152`) usado como se fosse widget de cálculo. Só 2 cartões em todo o seed usam `[revelar]` (grep: seed:497, 500), ambos nesta lição, então o escopo de correção é pequeno.
- Outras lições com cálculo implícito (candidatas ao mesmo problema): 1.4 (CDB x CDI), 1.5 (alíquota por prazo), 1.7/1.8 (deságio e marcação a mercado: fórmula `Preço = VN ÷ (1+Taxa)^(DU/252)` no texto, seed:531), 1.10, 2.6.x (indicadores).

Padrão correto proposto:
- Regra de conteúdo (adicionar às diretrizes de autoria e a um teste de seed): é proibido texto que mande o aluno "calcular" sem widget na mesma fase. Teste de lint do seed: se o texto casa `/calcul(e|ar)/i` na fase, exigir um widget declarado naquela fase.
- Regra de UI: `[revelar]` deixa de existir como botão solto "Ver resultado". O mecanismo passa a ser "revelação de resposta de widget": o widget calcula com os valores que o aluno ajusta, e o resultado do cenário-alvo aparece dentro do próprio widget (bloco de resultado `aria-live="polite"`). Se algum conteúdo ainda precisar de reveal, o botão terá rótulo contextual vindo do seed (`[revelar:Ver o cálculo com 22,5% de IR]`).
- Para a 1.6, usar o widget `equivalent-rate` (ver pedido 5): inputs taxa isenta (9,50), alíquota por faixa de prazo (22,5/20/17,5/15), taxa CDB (12,00); saída: taxa bruta equivalente e veredito CDB vs. isento, com o aluno trocando o prazo e vendo o vencedor virar. Os dois cartões `[revelar]` viram texto normal (cartões 3 e 4) que descrevem os dois cenários pré-carregados como "presets" do widget (botões "60 dias" e "720 dias").
- Em microDecision, a pergunta "qual rende mais líquido, LCI 9,50% ou CDB 12,00% com IR a 60 dias?" também pode embutir o widget na própria Micro-decisão (ver o contrato `widgets` abaixo), com aposta ao lado, para o aluno calcular dentro da plataforma antes de responder.

## 5. Catálogo e arquitetura de widgets (pedido 5)

Diagnóstico da arquitetura atual:
- Não há registro: widgets estão em `if` por enum em `Lesson/index.tsx:247-248, 299-318`. Adicionar widget = alterar enum no pgEnum (`schema.ts:46`), tipo de domínio (`domain/lesson.ts:28`), tipo no front (`services/lessons/types.ts:4`), `EMBEDDED_WIDGET_TYPES` (:39), o JSX e o seed. Cinco lugares.
- Um widget por lição e só em posição fixa (Micro-decisão ou Revelação). Não existe widget no Cenário, nem vários por fase, nem no meio de um cartão.
- Widgets são componentes de página inteira embutidos (Calculadora) sem props de configuração por lição (ex.: 0.2 sempre abre vazio, `GrowthCalculatorForm` nasce com capital 0).
- Telas de lição visualmente vazias: `.card` é só eyebrow + h1 + `<p>`; nenhuma ilustração/gráfico por padrão.

Arquitetura proposta (renderização guiada por dados):
1. Contrato no seed: o texto das fases ganha blocos tipados, em vez de string única. Introduzir `content` JSON versionado por fase, mantendo as colunas de texto atuais como fallback (migração aditiva, nada é removido):
   ```ts
   // lessons.blocks jsonb null  (null => usa scenarioText/microDecisionPrompt/revelationText atuais)
   type LessonBlocks = {
     schemaVersion: 1
     phases: { scenario: Block[]; microDecision: Block[]; revelation: Block[] }
   }
   type Block =
     | { type: 'text'; markup: string }               // {{Termo}}, {{ref:X.Y}} como hoje
     | { type: 'widget'; widget: WidgetId; props: unknown; caption?: string; id: string }
     | { type: 'check'; kind: 'single_choice'; options: string[]; hints?: (string|null)[] } // gabarito só no servidor
   ```
   `splitIntoCards` continua valendo para blocos `text`. Cada `widget` é um cartão próprio (um widget por cartão evita tela cheia de coisa e simplifica "voltar").
2. Registro no frontend: `features/lessons/widgets/registry.ts` mapeia `WidgetId -> { component, propsSchema (Zod), summary(props): string }`. Props validadas em runtime com Zod ao carregar a lição; widget inválido renderiza um fallback (texto `caption` + aviso discreto) em vez de quebrar a página. Um `WidgetBoundary` (error boundary) protege o player.
3. Validação no backend: o mesmo schema por widget vive em `backend/src/modules/lessons/domain/widgets/` (Zod) e é usado pela validação do seed e (futuramente) do editor N.23. Para não duplicar, versionar o contrato JSON em `shared` ou gerar tipos; no mínimo, teste de contrato que roda os exemplos do seed contra o schema do front (vitest) e do back.
4. Contrato de widget: props só de configuração (valores iniciais, limites, presets nomeados, rótulos); saída apenas visual. Widgets são stateless em relação ao servidor (como a Calculadora, 6.7), exceto os que consomem dados ao vivo, que usam hooks de leitura existentes (`useAssetByTicker`, `useIndicatorHistoryQuery`). Eventos opcionais `onInteract` para métrica futura (N.18), sem rede por padrão.
5. Interação com a aposta: widgets podem ter `requiresInteraction: true`; o cartão só libera "Continuar" depois de uma interação real (ex.: mover o slider). Evita o botão passivo.
6. Acessibilidade (obrigatória em todo widget): rótulos nos inputs; sliders com `<input type="range">` nativo + valor numérico editável; resultado em região `aria-live="polite"`; todo gráfico traz resumo textual (`summary()` do registro) e tabela alternativa recolhível; nunca só cor (convenção sólido/tracejado, `identidade-visual-padroes.md` §3); foco visível; sem animação essencial quando `prefers-reduced-motion`; alvos >= 44 px.
7. Responsividade nos 3 breakpoints: cada widget declara layout próprio. Mobile `< 768px`: tudo empilhado, inputs em largura total, gráfico acima dos controles, sem scroll horizontal. Tablet `768-1023px`: controles em 2 colunas. Desktop `>= 1024px`: o player ganha composição própria (regra do CLAUDE.md "desktop não é mobile esticado"): coluna de texto + painel de widget lateral fixo (grid 1fr / 420px) em vez de widget empilhado abaixo do texto; hoje `.page` tem `max-width: 720px` (`Lesson/index.module.css`). Tokens da `identidade-visual-tokens.md` apenas.
8. Cópia: nada de travessão como pontuação em texto de UI (memória do autor); presets e legendas do seed passam por teste de lint (`—` fora de comentários).
9. Testes por widget: unit da função pura de cálculo (table-driven, mesmo rigor das fórmulas financeiras), teste de componente (interação, `aria-live`, estados limites), teste de contrato do schema com os exemplos do seed.

Biblioteca proposta (id, uso, props principais, lições-alvo):

| id | Visual / interação | Props (resumo) | Lições |
|---|---|---|---|
| `compound-growth` | Simulador de juros compostos com sliders (capital, aporte, taxa, prazo) + gráfico simples vs. composto | `initial`, `monthly`, `ratePct`, `rateUnit`, `months`, `showSimple`, `limits` | 0.2, 0.3, 0.4, 3.1 (substitui `growth_calculator`) |
| `real-return` | Barra nominal vs. IPCA vs. real; slider de inflação | `nominalPct`, `inflationPct` | 0.3, 0.4, 0.5, 1.9 |
| `equivalent-rate` | Calculadora de taxa bruta equivalente com presets de prazo e veredito | `exemptRatePct`, `cdbRatePct`, `daysPresets[]`, `taxTable` | 1.6, 3.3 |
| `ir-regressive-table` | Tabela/linha regressiva de IR (22,5/20/17,5/15) com marcador de dias arrastável e valor líquido | `grossAmount`, `ratePct`, `brackets[]` | 1.5, 1.6, 3.3 |
| `mtm-seesaw` | Gangorra de marcação a mercado: slider de taxa de mercado move o preço do prefixado | `faceValue`, `contractRatePct`, `daysToMaturity`, `marketRateRange` | 1.7, 1.8, 1.10 |
| `fgc-coverage-bar` | Barra de cobertura do FGC (R$250 mil por CPF e instituição; teto global R$1 mi em 4 anos) com valor aplicado ajustável | `amount`, `perInstitutionLimit`, `globalLimit`, `institutions[]` | 1.4, 1.6, 1.11 |
| `interactive-balance` | Balanço interativo: toque em ativo/passivo/patrimônio e veja o indicador (margem, ROE, endividamento) mudar | `lines[]`, `indicator` | 2.6.1-2.6.5 |
| `product-comparator` | Comparador de 2-3 produtos (prazo, IR, risco, liquidez, FGC) com destaque do vencedor para um cenário | `products[]`, `scenario` | 1.4, 1.6, 3.3, 3.4 |
| `timeline` | Linha do tempo (IPO, data ex, vencimento, Copom) com marcos clicáveis | `events[{at,label,detail}]` | 2.2, 2.7, 1.3 |
| `order-book` | Livro de ofertas simplificado (oferta e demanda) com slider de preço | `bids[]`, `asks[]` | 2.5, 2.1 |
| `risk-return-scatter` | Dispersão risco x retorno com perfil do investidor | `assets[]`, `profile` | 3.1, 3.2 |
| `allocation-donut` | Alocação por classe, arrastar percentuais | `classes[]`, `total` | 3.1, 3.2, 3.4 |
| `live-indicator` / `live-macro` | Os dois widgets de dados ao vivo existentes, migrados para o registro | `ticker` / `window` | 2.6.x, 1.3, 1.9 |
| `callout` | Destaque visual (ícone + termo-chave + fórmula), sem interação, para a tela deixar de ser só texto | `tone`, `title`, `body`, `formula?` | todas |

Ordem de entrega sugerida: infra + `callout` + migração dos 4 widgets existentes, depois `equivalent-rate` (urgente, pedido 4), `mtm-seesaw`, `ir-regressive-table`, `fgc-coverage-bar`, e os demais.

## 6. Card "Complete a lição" (pedido 6)

Todos os usos de `LockedAssetPanel` (texto `Complete a lição "…" na trilha pra liberar isso.`, `components/molecules/LockedAssetPanel/index.tsx:27`):

| Uso | Arquivo:linha | Contêiner | Resultado visual |
|---|---|---|---|
| Rota inteira (Portfólio, Calculadora, Notícias) via `RequiresUnlock` -> `LockedScreen` | `features/lessons/RequiresUnlock/index.tsx:36`, `components/molecules/LockedScreen/index.tsx:85`, `LockedScreen/index.module.css` (`.page`: flex, centro, `min-height: 60vh`, `max-width: 720px`) | flex centrado | card encolhe ao conteúdo (`align-items: flex-start` + `.panel` sem largura), pequeno e no meio da tela |
| Detalhe de Ativo travado | `pages/AssetDetail/index.tsx:91` | `.page` flex column (`pages/AssetDetail/index.module.css:1-4`), sem `max-width` | card estica na largura inteira do `main` do AppShell (largo no desktop) e fica no topo |
| Detalhe de Renda Fixa travado | `pages/FixedIncomeDetail/index.tsx:71` | idem acima | idem |
| Diálogo de confirmação de ordem | `components/organisms/OrderConfirmationDialog/index.tsx:155` | `.panel` do diálogo, `max-width: 420px` (`OrderConfirmationDialog/index.module.css:35`), sem `lessonId` | card dentro de modal, só título sem CTA de navegação (usa `Ir pra lição` que leva para `/trilha`) |
| Pistas menores (não usam o painel): `LockedAssetBadge` (`components/molecules/LockedAssetBadge/index.tsx`, só ícone 14 px), `TabBar` e `NewsBell` com `aria-label` de travado | `components/organisms/TabBar/index.tsx:52`, `components/molecules/NewsBell/index.tsx:25` | | |

Causa raiz da inconsistência: o painel (`LockedAssetPanel/index.module.css`) não define largura nem altura, só `padding: var(--space-4)`, e herda o comportamento do contêiner (shrink-wrap em `LockedScreen`, `stretch` nas páginas de detalhe, 420 px no diálogo). Dois wrappers (`LockedScreen`, e o `<main className={styles.page}>` repetido em AssetDetail e FixedIncomeDetail) duplicam a responsabilidade de layout. Além disso o visual é um cartão neutro de borda fina, com ícone de 20 px e texto cinza, que não "grita" bloqueio.

Proposta: um único componente `LockedGate` (organismo, `components/organisms/LockedGate/`), substituindo `LockedAssetPanel` + `LockedScreen`.
- Props: `variant: 'screen' | 'section' | 'inline'`, `lessonId?`, `lessonTitle?`, `reachable?`, `subject?: string` (o que está travado: "Carteira", "Calculadora", "Notícias", "PETR4"), `onClose?` (para o modal). Cópia derivada de `subject` e `lessonTitle`, sem código da lição (regra fixada pelo autor em 2026-09-12, comentário em `LockedAssetPanel/index.tsx:15-18`).
- Variantes: `screen` (rota inteira): ocupa o contêiner de conteúdo, centralizado, ícone de cadeado grande (48 px) em um selo com fundo `--color-gamify-*` leve, título, descrição, CTA primário "Ir pra lição" e, se aplicável, link "Ver trilha". `section` (dentro de página/painel): largura 100% do pai com `max-width: 560px`, alinhado à esquerda/centro conforme o pai, ícone 32 px. `inline` (diálogo/linha): compacto, sem CTA primário grande, usa botão secundário. Tamanho de ícone/texto/padding é decidido pela variante, nunca pelo contêiner.
- Sinalização de relance: faixa de acento no topo ou borda tracejada (convenção sólido/tracejado da identidade, §3), cadeado destacado, título "Bloqueado pela trilha" em peso 600, linha de progresso opcional "Faltam N lições" quando a alcançabilidade (`reachable`) permitir calcular (já existe `findLessonUnlocking`, `features/lessons/unlockedKeys`). Cores só por tokens (`identidade-visual-tokens.md`), claro/escuro testados.
- Responsivo: mobile (< 768 px) full-bleed com padding `--space-4`, CTA 100% de largura; tablet 2 linhas; desktop (>= 1024 px) variante `screen` com composição própria (ilustração/selo à esquerda, texto + CTA à direita) em vez de bloco estreito centrado, evitando "espaço morto nas laterais".
- Acessibilidade: `role="note"` mantido na seção, `role="status"` na tela cheia; título como `h2`; CTA como botão com nome completo ("Ir para a lição Tesouro Selic"); contraste AA.
- Migração: `RequiresUnlock` usa `variant="screen"`; `AssetDetail`/`FixedIncomeDetail` usam `variant="section"` (remover o `<main>` duplicado em favor do layout comum); `OrderConfirmationDialog` usa `variant="inline"`. Remover `LockedScreen` e `LockedAssetPanel` (e seus testes), portar os testes. Atualizar os testes que buscam o texto `Complete a lição` (`LockedScreen/index.test.tsx`, `LockedAssetPanel` tests, `pages/AssetDetail`, `FixedIncomeDetail`, `RequiresUnlock/index.test.tsx`, `News/index.test.tsx`, `TabBar`/`AppShell` tests mencionam `RequiresUnlock`).
- Sem mudança de backend.

## 7. Seed idempotente e a tarefa N.23

Fatos:
- Hoje `upsertLessonSeed` (`seedLessons.ts:1456-1484`) usa `onConflictDoUpdate` e sobrescreve TODAS as colunas de conteúdo a cada `npm run db:seed:lessons`. A N.23 (`.claude/backlog-motor-mercado-realista.md:3079`, ainda ⬜, bloqueada por N.18) muda isso para insert-only por `stable_key` e torna o banco a fonte da verdade; `seedLessons.test.ts` (:69-98) será reescrito. O painel ainda não edita lições, então hoje não há edição admin a perder, mas há uma janela: assim que a N.23 entregar, qualquer conteúdo novo precisará chegar por migração de dados, não por reseed.
- Consequência para este trabalho, em ordem de segurança:
  1. Mudanças ADITIVAS de schema (colunas `blocks`, `micro_decision_hints`, `micro_decision_attempts`, `micro_decision_solved_at`) em migration, com backfill SQL. Nunca renomear/remover as colunas atuais; o fallback de texto continua válido.
  2. Se a N.23 ainda não estiver feita quando o conteúdo novo for escrito: o seed pode atualizar `blocks`/`hints` (campos novos) e o `onConflictDoUpdate` atual continua valendo para o resto (sem edição admin ainda). Incluir `blocks`/`hints` no `set` agora e, na N.23, tirá-los junto com o resto.
  3. Se a N.23 já estiver feita: o conteúdo novo (widgets na 1.6 etc.) entra por migração de dados versionada (`lesson_content_patches`, aplica só se a linha não foi editada: comparar `revision` / `updated_by_admin_at`). Regra: nunca sobrescrever uma lição que tenha revisão admin. Registrar a dependência em N.23: o editor precisa suportar `blocks` (JSON) e `hints`, com preview usando o mesmo registro de widgets.
  4. Recomendação de ordem: fazer o player e o contrato (tarefas abaixo) ANTES da N.23, para que o editor da N.23 já nasça sobre `blocks`/registro de widgets (evita retrabalho do editor).
- Teste obrigatório do seed (novo): reexecutar o seed não altera uma lição marcada como editada (quando N.23 existir) e não duplica linhas; já existe cobertura de `stableKey` (:79-98).

## 8. Riscos de regressão

- Progresso existente: o gate `micro_decision_unsolved` só vale na transição 1->2; backfill de `solved_at` cobre quem já passou. Sem o backfill, usuários em passo >= 2 não seriam afetados de qualquer forma, mas o dado de funil ficaria nulo (aceitável). Testar migração em banco com progresso real (padrão da N.24).
- Semântica de `micro_decision_selected_option` muda de "última escolha" para "primeira escolha"; todo consumidor (`getCurrentMicroDecisionStreak`, `hasMicroDecisionStreakToday`, `getTracksCompletedWithoutErrorsCount`, `exportLessonProgress`) continua correto porque leem esse campo como "tentativa válida". Revisar `exportLessonProgress` (LGPD) para incluir `attempts`.
- Gate do passo 1->2 + `LESSON_MIN_STEP_INTERVAL_MS`: o aluno que responde rápido continua esperando 5 s no avanço; o endpoint `/answer` não pode resetar `updated_at`. Teste dedicado.
- Revisão: nenhuma chamada a `/progress` em modo revisão; endurecer o backend contra regressão de `current_step` (teste: `/progress` em lição concluída não muda a linha).
- Missão H.2 passa a exigir chegar à Revelação em modo revisão; avisar que "abrir a lição" deixa de bastar. Testes existentes (`Lesson/index.test.tsx:366-381`) mudam.
- Quebra de contrato: `selectedOption` em `/progress` deprecado; manter aceitando e ignorando por uma versão (Zod `.optional()` + comentário), atualizar `.docs/backend/lessons.md`, `frontend/src/services/lessons/types.ts` e `useAdvanceLesson`.
- Dados ao vivo/ETL: widgets `live-*` dependem do motor; manter fallback de carregamento e erro (já existe para `indicatorAsset.isLoading`).
- Tela vazia ao falhar validação de `blocks`: sempre cair em texto legado.
- Copy: sem travessão como pontuação; textos do seed novos passam por lint.
- Idempotência do seed: ver seção 7. O avanço e o `completeIfNotAlreadyCompleted` (corrida) não mudam.
- `LockedGate`: muitos testes dependem do texto `Complete a lição "…" na trilha pra liberar isso.`; manter a frase ou atualizar todos juntos.

## 9. Testes necessários

- Backend unit (vitest, fakes em `modules/lessons/test/fakes`): `AnswerMicroDecisionUseCase` (primeira tentativa grava escolha imutável, tentativas incrementam, acerto grava `solved_at`, lição sem aposta -> 422, fora de ordem -> 422, lição concluída é stateless, `correctOptionLabel` só em acerto, não altera `updatedAt`); `AdvanceLessonUseCase` (gate 1->2, grandfathering, lição concluída não escreve, XP idempotente); domínio (`domain/lesson.test.ts`) para as funções novas; Zod de `blocks` por widget.
- Backend router (supertest): `POST /lessons/:id/answer` (400 payload, 404, 422, 200 certo/errado), `POST /progress` (422 `micro_decision_unsolved`), `GET` nunca expõe gabarito.
- Adapter (Postgres descartável via `TEST_DATABASE_URL`): migração/backfill, update de tentativa sem tocar `updated_at`, corrida de duas respostas simultâneas.
- Seed: teste de contrato (todo `blocks` do seed valida no schema de cada widget; nenhuma lição manda "calcular" sem widget; sem travessão em copy; idempotência/`stableKey`).
- Frontend: `useLessonNavigation` (voltar, preservar estado, não chamar POST ao revisitar fases), `Lesson/index.test.tsx` (revisão sem POST, aposta errada não avança, acerto libera, hints, foco/`aria-invalid`), cada widget (unit da função pura + componente + a11y com `jest-axe` se já usado), registro (widget inválido -> fallback), `LockedGate` por variante nos 3 breakpoints (render com `matchMedia` ou testes CSS-agnósticos de props), snapshot dos usos migrados.
- E2E (`backend/test/e2e/`, hoje sem jornada de lições; só `support/lessons.ts` com helper de passos): nova `lessonJourney.e2e.test.ts`: usuário novo conclui uma lição com aposta (erra, tenta de novo, acerta, avança), tenta avançar sem acertar (422), reabre a lição concluída e responde de novo sem mudar XP/streak/progresso (conferir `GET /gamification` e `GET /lessons` antes/depois), `selectedOption` antigo no `/progress` ignorado. Atualizar `support/lessons.ts` (`advance`) para responder a aposta antes de avançar, senão as jornadas `equityOrderJourney`/`fixedIncomeRedemptionJourney` quebram no gate. Lembrar do relogin do admin (`support/tick.ts`) em jornadas longas.
- Validação ao vivo em `docker compose up` (checklist do CLAUDE.md), com screenshot nos 3 breakpoints.
- Documentação: `.docs/backend/lessons.md` (endpoint novo, erro novo, `selectedOption` deprecado).

## 10. Quebra em tarefas (uma sessão cada)

Prefixo sugerido `P.x` (player de lição); registrar em novo backlog `.claude/backlog-player-licao.md` com Entregável ao concluir, como nos demais.

| # | Tarefa | Depende de | Critérios de aceite |
|---|---|---|---|
| P.1 | **Modo revisão local + endurecimento do backend.** Player começa em 0 para lição `completed`, navega sem chamar `/progress`; `/progress` em lição concluída não escreve; `reviewLesson` dispara ao chegar na Revelação; rótulo "Rever" no `LessonNode`. | nenhuma | Abrir lição concluída mostra Cenário; nenhum POST de progresso em revisão; `current_step`, `selectedOption`, XP, streak, missões H.2 inalterados (teste de backend + frontend); testes antigos de `Lesson/index.test.tsx:366-381` reescritos. |
| P.2 | **Navegação com "Voltar" (reducer do player).** `useLessonNavigation`, botão Voltar entre cartões e fases, estado de revelação/escolha preservado, sem POST ao reavançar fases já vistas. | P.1 | Voltar em qualquer cartão exceto o primeiro do Cenário; reavançar não gera 422 nem espera 5 s; `selectedOption` e veredito preservados; teclado e leitor de tela ok. |
| P.3 | **Backend da aposta com tentativas ilimitadas.** Migration `0021` (`attempts`, `solved_at`, `hints`, backfill, `when` > 1791200000000), `AnswerMicroDecisionUseCase`, `POST /answer`, gate 1->2, `selectedOption` deprecado, `.docs/backend/lessons.md`. | nenhuma (paralelizável com P.1) | Primeira escolha imutável; tentativas contadas; gabarito só em acerto; 422 sem resolver; não reseta `updated_at`; migration testada com progresso real; conquistas/missões H.1/H.3 inalteradas para dados antigos; testes unit/router/adapter. |
| P.4 | **Frontend da aposta "só avança ao acertar".** Botão Responder, feedback de erro com hint, travar após acerto, revisão stateless, adaptação de `useAdvanceLesson`/services, atualização do e2e `support/lessons.ts` e nova `lessonJourney.e2e.test.ts`. | P.2, P.3 | Errar nunca avança; tentativas ilimitadas; acerto libera e mostra "acertou de primeira"/"na Nª"; a11y (`aria-invalid`, `role=alert`, foco); jornadas e2e existentes seguem verdes. |
| P.5 | **`LockedGate` unificado.** Componente com variantes `screen/section/inline`, migração dos 4 usos, remoção de `LockedAssetPanel`/`LockedScreen`, testes. | nenhuma (paralelizável) | Mesmo tamanho/estilo em todas as telas por variante; aparência claro/escuro; 3 breakpoints; cadeado inequívoco; textos sem código de lição; mockup/rascunho antes da implementação (tela-âncora de padrão visual). |
| P.6 | **Infra de widgets: `blocks` (migration aditiva), registro, Zod por widget, `WidgetBoundary`, layout desktop em duas colunas, `callout`, migração dos 4 widgets existentes para o registro.** Fallback de texto legado. | P.2 | Lição sem `blocks` renderiza igual a hoje; `blocks` inválido cai no legado; enum `microDecisionType` continua válido (deprecado); contrato testado no front e no back; mockup do player desktop antes. |
| P.7 | **Widgets de cálculo de renda fixa** (`equivalent-rate`, `ir-regressive-table`) e reescrita da lição 1.6 (e 1.5). Remoção de `[revelar]`/"Ver resultado" solto (rótulo contextual se sobrar). | P.6 | Nenhum texto manda calcular fora; 1.6 tem widget com presets 60/720 dias; testes table-driven das fórmulas (9,50÷0,775≈12,26%; 9,50÷0,85≈11,18%); lint do seed "calcule sem widget". |
| P.8 | **Widgets de risco e proteção** (`mtm-seesaw`, `fgc-coverage-bar`, `product-comparator`) e conteúdo das lições 1.4, 1.7, 1.8, 1.10, 1.11, 3.3. | P.6 (P.7 opcional) | Cada widget com `summary` textual, `aria-live`, responsivo; lições atualizadas; revisão de copy (sem travessão). |
| P.9 | **Widgets de ações e planejamento** (`interactive-balance`, `timeline`, `order-book`, `risk-return-scatter`, `allocation-donut`, `real-return`, `compound-growth` substituindo `growth_calculator`) e conteúdo de Trilhas 0, 2 e 3. Pode ser dividida em 2 sessões. | P.6 | Idem P.8; `growth_calculator` e `fixed_income_comparison` removidos do enum só em tarefa de limpeza posterior. |
| P.10 | **Compatibilidade com N.23.** Ajustar `upsertLessonSeed` (campos novos fora do `set` quando a N.23 virar insert-only), editor/preview com `blocks`+`hints`, patch de dados versionado para conteúdo novo, teste "reseed não desfaz edição". | P.6, N.23 | Reexecutar o seed não desfaz edição feita no painel; editor edita `blocks`/`hints` com a mesma validação; preview idêntico ao player. |

Paralelismo: {P.1, P.3, P.5} podem rodar em paralelo; P.2 após P.1; P.4 após P.2 e P.3; P.6 após P.2; P.7-P.9 após P.6. Prioridade pelos pedidos do autor: P.1, P.3+P.4 (aposta), P.7 (conta externa), P.5, P.2, depois biblioteca (P.6, P.8, P.9) e P.10 quando a N.23 for pega.

## 11. Decisões de produto pendentes (registrar em `.claude/pontos-em-aberto-decisao-produto.md` se o autor não responder)

1. XP por acerto de primeira (hoje 50 fixo): manter ou bonificar?
2. Revisão registra a missão H.2 ao chegar na Revelação (proposta) ou continua ao abrir?
3. Gabarito só em acerto (proposta) ou também após N erros ("desistir e ver")?
4. Hints por alternativa: autoria obrigatória ou opcional com texto genérico?
5. Ordem P.x vs. N.23 (recomendação: contrato de widgets/`blocks` antes do editor).

Observação de rastreabilidade: comentários desatualizados a corrigir na tarefa que os tocar: `pages/Lesson/index.tsx:33-38` e `backend/src/modules/lessons/domain/lesson.ts:24-27` ainda citam o checkbox "já pensei", que não existe mais.
