# Backlog — Engajamento e Gamificação

Backlog executável derivado de `.claude/proposta-engajamento-licoes.md` (estudo pedido pelo autor
depois da autoria das 33 lições, tarefas 7.1.1–7.1.6, com o cronograma adiantado em relação ao
roadmap de 8 semanas da spec). Cobre tanto a experiência de lição (Fases A-D) quanto o restante da
camada de gamificação — Perfil, feed social, missões, conquistas e o "teatro de recompensa"
citado em `identidade-visual-padroes.md` §6, hoje só documentado, nunca implementado como
componente reutilizável (Fases E-I), e o tratamento de conteúdo travado pela trilha (tarefa 7.0.1,
já em produção) que hoje arrisca desmotivar quem esbarra num módulo bloqueado (Fase J).

> **Revisão de auditoria (mesma sessão):** antes de liberar pra implementação, cada tarefa foi
> conferida contra o código real em busca de ambiguidade — 3 achados corrigiram descrição errada
> (não só imprecisa): **Fase G** assumia um feed de amizade já existente (não existe nenhum, só
> `Amigos`/`BuscarAmigos`, ambos hub/busca sem atividade); **Fase F (antiga F.2)** assumia dar pra
> reaproveitar `GET /lessons` pra ler trilha concluída de outro usuário (essa rota só lê o próprio
> `req.auth.userId` — confirmado no código —, então precisa de campo novo em
> `GetPublicProfileUseCase`); e **Fase I** tratava XP/nível/conquista/streak como "se ainda não
> exposto" quando na verdade **já estão computados** (`AwardXpUseCase` devolve
> `{xp, level, leveledUp}`, `CheckAndUnlockAchievementsUseCase` devolve `Achievement[]`) só que
> descartados no caminho — as portas `XpAwarder`/`StreakTracker`/`AchievementChecker` declaram
> `Promise<void>` de propósito e jogam fora o resultado rico da chamada de baixo. Os 3 casos
> viraram tarefas novas ou reordenadas abaixo. Também: o marco de streak "14 dias" citado na
> versão anterior não existe em `seedAchievements.ts` (só 7 e 30) — corrigido.

**Como usar este arquivo** — mesma disciplina do `backlog-plataforma-investimentos.md`:

1. Siga a **sequência sugerida** na seção final, não a ordem alfabética das fases — a ordem A-I é
   só agrupamento temático; a sequência já resolve as dependências reais entre tarefas de fases
   diferentes.
2. Cada tarefa é escopo de uma sessão. Não empacote várias tarefas numa sessão só.
3. Ao concluir uma tarefa, verifique os critérios de aceite antes de considerar pronta, e marque
   ✅ + acrescente um bullet de Entregável (mesmo padrão do backlog principal).
4. Toda tarefa que toca `backend/` passa pelo checklist do `CLAUDE.md` (ports/adapters, Zod na
   borda HTTP, teste no mesmo commit, `.docs/backend/<módulo>.md` atualizado se o contrato de
   rota mudar, `docker compose up` antes de fechar).
5. **B.1, D.1, F.2, G.1, H.1 e I.2 tocam schema ou o formato de resposta de rotas já em uso** —
   cada uma diz explicitamente o que muda de contrato; nenhuma quebra o consumidor atual sem
   avisar (campo novo sempre nullable/opcional, nunca campo removido).
6. Nenhuma regra crítica do `CLAUDE.md` é reaberta aqui (capital fixo em R$10.000, janela de
   ranking, RNF09 — valor absoluto nunca exposto, `role=admin` nunca por autocadastro). Nenhuma
   tarefa abaixo toca essas regras; se alguma parecer que precisa, pare e confirme antes.

---

## Fase A — Fatiar o conteúdo que já existe

Frente A da proposta, risco baixo, sem migration. Objetivo: os mesmos números e fórmulas já
escritos, entregues em cartões pequenos em vez de parágrafo único.

### A.1 · Convenção de cartões + parser no frontend ✅ concluída

- **Descrição:** hoje `scenarioText`/`microDecisionPrompt`/`revelationText` são uma `string` só,
  renderizada como um único `<p>` (`frontend/src/pages/Lesson/index.tsx`, passos 0/1/2). Introduzir
  a convenção de que uma quebra dupla de linha (`\n\n`) dentro desses campos separa cartões
  independentes — confirmado nesta sessão que nenhuma das 33 lições usa `\n\n` hoje
  (`grep -c '\\n\\n' backend/src/db/seedLessons.ts` = 0), então é retrocompatível: uma lição sem
  `\n\n` continua renderizando como hoje, 1 cartão só.
- **O que muda na aplicação:**
  - `frontend/src/features/lessons/` ganha uma função pura nova (`splitIntoCards` ou similar,
    testada) que recebe a `string` do campo e devolve `string[]`.
  - `Lesson/index.tsx` ganha um `subStep` local (estado, não persistido — a persistência de
    progresso continua sendo só o `step` de fase, spec 5.2) navegando pelos cartões de cada fase
    antes de habilitar o "Continuar" que avança de fase de verdade; barra de progresso fina
    interna à fase (pontinhos menores), sem mudar a barra grande de 4 segmentos existente.
  - Nenhuma mudança de schema, de rota HTTP ou de `AdvanceLessonUseCase` — puramente frontend.
- **Critérios de aceite:** uma lição com `\n\n` no meio do texto renderiza N cartões com
  "Continuar" entre eles; uma lição sem `\n\n` (ainda não reescrita) continua funcionando
  exatamente como hoje; navegação por teclado/foco funciona entre cartões.
- **Entregável:** `features/lessons/splitIntoCards` (função pura + teste table-driven cobrindo
  texto sem separador, separador simples, bordas com espaço e `\n\n\n\n` repetido sem gerar
  cartão vazio no meio). `pages/Lesson/index.tsx` ganhou `subStep` (estado local, resetado a cada
  avanço real de fase em `handleAdvance`) aplicado às 3 fases com texto livre (Cenário, Micro-decisão,
  Revelação); `handleCardContinue` decide entre avançar o cartão local ou disparar o avanço de fase
  real conforme a posição no array de cartões. O widget embutido (`GrowthCalculatorForm`/
  `FixedIncomeComparisonForm`), o checkbox "Já pensei..." e o painel de indicador ao vivo só
  aparecem no último cartão da fase (fariam pouco sentido antes do usuário ler o prompt/revelação
  inteiros). `CardDots` — pontinhos de progresso interno à fase, menores que a barra de 4
  segmentos existente, só renderizados quando a fase tem mais de 1 cartão, `aria-hidden` (o único
  controle interativo continua sendo o botão "Continuar", preservando navegação por teclado).
  Passo 3 (Desbloqueio/`unlocksDescription`) não entra no escopo — só os 3 campos citados na
  descrição. Testes novos em `Lesson/index.test.tsx` cobrindo navegação entre cartões, gate do
  checkbox no último cartão e ausência de pontinhos quando a lição não usa `\n\n` (retrocompatibilidade).
- **Referências:** `proposta-engajamento-licoes.md` §2 (Frente A, técnica "Fatiamento por ideia");
  spec 5.2 (as 4 fases continuam intactas).
- **Dependências:** nenhuma.

### A.2 · Reescrita das 33 lições em cartões ✅ concluída

- **Descrição:** aplicar a convenção da A.1 ao conteúdo já escrito (`backend/src/db/seedLessons.ts`),
  seguindo a regra de redação: nenhum cartão passa de ~45 palavras, nenhum cartão introduz mais de
  1 número novo. Prioridade pelas lições com maior `revelationText` hoje (1.5, 1.6, 1.9, 2.6.4,
  2.9 — qualquer uma com "mas" ou dois-pontos duas vezes no meio do parágrafo é candidata certa).
  Nenhum número, fórmula ou correção de conteúdo muda — só a unidade de exibição.
- **O que muda na aplicação:** só `backend/src/db/seedLessons.ts` (conteúdo) + rodar
  `db:seed:lessons` (já usa `onConflictDoUpdate` desde a 7.1.1, atualiza sem duplicar).
- **Critérios de aceite:** as 33 lições reescritas; nenhum valor numérico (taxa, fórmula, ticker)
  diferente do texto original; `docker compose up` + Chrome real confirmando visualmente pelo
  menos as 5 lições mais densas (1.5, 1.6, 1.9, 2.6.4, 2.9) fatiadas corretamente.
- **Entregável:** as 33 lições de `LESSON_SEEDS` (`backend/src/db/seedLessons.ts`) reescritas com
  `\n\n` marcando cartões, seguindo a mesma disciplina da A.1 (só reordena o texto original em
  `scenarioText`/`microDecisionPrompt`/`revelationText` — nenhuma palavra, número, fórmula ou
  ticker mudou; verificado por script de comparação palavra-a-palavra entre a versão antiga e a
  nova, ignorando só as quebras `\n\n` e pontuação leve). As 5 lições mais densas (1.5, 1.6, 1.9,
  2.6.4, 2.9) seguiram a régua da 1.5 do `proposta-engajamento-licoes.md` §2 (resposta curta →
  fórmula/régua → resultado 1 → resultado 2 → conclusão), a maioria em 3-5 cartões; sentenças
  muito longas isoladas (>45 palavras) foram quebradas num ponto interno (dois-pontos/ponto e
  vírgula convertido em ponto final, com a conjunção "e" removida quando a frase virava duas
  frases — único ajuste de pontuação feito, nenhum fato/número). Rodado `npx prettier --write` +
  `npm run lint`/`build`/`test` (448 testes, sem regressão) e `docker compose up` real com
  `db:seed:lessons` + Chrome (mobile, 390×844) confirmando as 5 lições prioritárias renderizando
  cartões, pontinhos de progresso e navegação corretamente ponta a ponta (Cenário → Micro-decisão
  → Revelação).
- **Referências:** exemplo completo da lição 1.5 fatiada em 5 cartões já está em
  `proposta-engajamento-licoes.md` §2 — usar como modelo de tom/tamanho pras demais.
- **Dependências:** A.1.

### A.3 · Revelação progressiva ("ver resultado") ✅ concluída

- **Descrição:** dentro do passo Revelação, quando um cartão contém um resultado calculado (uma
  taxa, um veredito de comparação), esconder esse número atrás de um botão "Ver resultado" em vez
  de mostrá-lo já na primeira leitura do cartão. **Convenção de marcação (decidida nesta revisão,
  não fica em aberto pra sessão futura):** um cartão cujo texto começa literalmente com o prefixo
  `[revelar] ` (colchetes + espaço) é tratado como "resultado escondido" — o parser da A.1 separa o
  prefixo do texto, remove-o da string exibida e marca o cartão com `hidden: true` na saída de
  `splitIntoCards`; a UI mostra só um botão "Ver resultado" no lugar do texto até o toque, então
  revela o texto completo no mesmo lugar (sem navegar pra outro cartão).
- **O que muda na aplicação:** `splitIntoCards` (A.1) passa a devolver
  `{ text: string; hidden: boolean }[]` em vez de `string[]`; `Lesson/index.tsx` ganha o estado de
  revelado/escondido por cartão; conteúdo (`seedLessons.ts`) marca os cartões de resultado da
  lição 1.5 (cartões 3 e 4 do exemplo da proposta) com o prefixo.
- **Critérios de aceite:** cartão marcado com `[revelar] ` não mostra o texto até o toque no
  botão; cartão sem o prefixo continua aparecendo direto (comportamento da A.1/A.2 preservado);
  não bloqueia navegação por teclado (botão "Ver resultado" é alcançável e ativável por teclado).
- **Entregável:** `features/lessons/splitIntoCards` ganhou `types.ts` (`Card = { text, hidden }`,
  mesma convenção de módulo-pasta da 6.3.4) e passou a devolver `Card[]`; o prefixo `[revelar] ` é
  detectado só no início do cartão já com `\n\n`/trim aplicados (texto que só *menciona*
  `[revelar]` no meio não vira hidden). `pages/Lesson/index.tsx` ganhou `revealedIndexes` (`Set`
  local, reseta junto com `subStep` a cada avanço real de fase — mesmo ciclo de vida) e o
  componente `CardBody`, reaproveitado nas 3 fases com texto livre (Cenário/Micro-decisão/
  Revelação, não só Revelação — o parser é compartilhado, então qualquer cartão marcado em
  qualquer um dos 3 campos já funciona); cartão `hidden` sem revelar mostra um botão real
  (`<button>`, ícone `Eye` do lucide-react) — navegação por teclado (Tab/Enter) funciona de graça,
  sem tratamento especial. "Continuar" não é bloqueado por cartão não revelado (não pedido nos
  critérios de aceite — decisão de escopo mínimo). `seedLessons.ts`: cartões 3 e 4 da revelação da
  lição 1.5 (os 2 vereditos numéricos, 12,26% vs 12,00% e 11,18% vs 12,00%) marcados com
  `[revelar] `. Testes novos em `splitIntoCards/index.test.ts` (prefixo remove hidden, cartão sem
  prefixo intocado, prefixo no meio do texto não conta, mistura de cartões normais/hidden no mesmo
  texto) e `Lesson/index.test.tsx` (botão aparece/esconde texto, toque revela sem avançar de
  cartão, acessível por teclado, cartão sem prefixo continua direto). `npm run lint`/`build`/`test`
  passam nos dois lados (frontend: 558 testes; backend: 448) e `docker compose up` real +
  `db:seed:lessons` + Chrome confirmaram visualmente o cartão 3 da Revelação da lição 1.5
  escondendo o resultado atrás de "Ver resultado" e revelando no mesmo lugar ao toque.
- **Referências:** `proposta-engajamento-licoes.md` §1 ("sem curiosity gap dentro do parágrafo") e
  §2 (técnica "Revelação progressiva").
- **Dependências:** A.1, A.2 (precisa de conteúdo já fatiado pra ter onde aplicar o gate).

---

## Fase B — Aposta com acerto/erro real

Impulso 3 (Empoderamento e Feedback) da proposta. Troca o checkbox genérico "já pensei na minha
resposta" por uma escolha real nas lições `reflection` com resposta objetiva — a maioria das 33.
Ao contrário do que a proposta estimou de forma otimista, isso **exige schema novo**, pequeno e
aditivo: sem opção/resposta correta gravadas em algum lugar, não existe "certo" ou "errado" pra
comparar.

### B.1 · Schema — opções e resposta correta ✅ concluída

- **Descrição:** duas colunas novas em `lessons` (`backend/src/db/schema.ts`):
  `microDecisionOptions` (`text[]`, nullable — 2 a 4 alternativas curtas) e
  `microDecisionCorrectOption` (`smallint`, nullable — índice da alternativa certa no array). Os
  dois ficam `null` por padrão: uma lição sem essas colunas preenchidas continua mostrando o
  checkbox de hoje (retrocompatível, mesmo padrão incremental da 7.0.2/7.1). Uma coluna nova em
  `user_lesson_progress`: `microDecisionSelectedOption` (`smallint`, nullable) — grava o que o
  usuário escolheu, necessário pra Fase H (conquista/missão de sequência de acertos) mais adiante
  poder consultar o histórico, não só o momento em que a escolha foi feita.
- **O que muda na aplicação:**
  - Migration nova (`backend/src/db/migrations/`) com as 3 colunas, todas nullable — sem
    `NOT NULL DEFAULT`, então não precisa de backfill.
  - `backend/src/modules/lessons/domain/lesson.ts` — `LessonSummary` ganha
    `microDecisionOptions: string[] | null` e `microDecisionCorrectOption: number | null`;
    `LessonProgressSnapshot` ganha `microDecisionSelectedOption: number | null`. Nova função pura
    testável `isCorrectOption(lesson, selectedOption)`.
  - `drizzleLessonRepository.ts` espelha as 3 colunas (leitura e escrita de progresso).
- **Critérios de aceite:** migration aplica sem erro em cima do banco com as 33 lições já
  seedadas; `GET /lessons/:id` devolve `microDecisionOptions: null`/`microDecisionCorrectOption: null`
  pras lições ainda não migradas de conteúdo (nenhuma quebra de contrato pro frontend atual);
  `isCorrectOption` testado table-driven (índice certo, índice errado, `null` como "sem aposta
  real ainda").
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 3); `.docs/backend/lessons.md`
  (atualizar contrato de `GET /lessons/:id`).
- **Dependências:** nenhuma.
- **Entregável:** migration `0013_add_lesson_micro_decision_options.sql` (3 colunas nullable, sem
  `NOT NULL DEFAULT` — `lessons.micro_decision_options` `text[]`,
  `lessons.micro_decision_correct_option` `smallint`,
  `user_lesson_progress.micro_decision_selected_option` `smallint`; `drizzle-kit generate` gerou
  sem prompt de rename-ambiguity, por serem colunas só aditivas — não caiu no problema já registrado
  em memória de sessões anteriores). `domain/lesson.ts`: `LessonSummary` ganhou os 2 campos,
  `LessonProgressSnapshot` ganhou `microDecisionSelectedOption`, função pura nova
  `isCorrectOption(lesson, selectedOption)` — 3 estados (`true`/`false`/`null`), não booleano:
  `null` cobre tanto "lição sem aposta real ainda" (`microDecisionCorrectOption === null`) quanto
  "usuário não escolheu nada" (`selectedOption === null`), já que nenhum dos dois é de fato "errou".
  `drizzleLessonRepository.ts` espelha as 3 colunas; `UpsertProgressInput.microDecisionSelectedOption`
  é opcional e distinto de `null` — `undefined` (campo ausente) não sobrescreve o valor já gravado,
  só a B.2 vai passar isto de verdade, mas o encanamento já existe pra não perder a escolha numa
  chamada de avanço de passo seguinte que não a inclua. `isCorrectOption` testado table-driven (5
  casos: acerto, erro, sem escolha, sem aposta real, os dois ausentes). Todos os 12 arquivos de
  teste do módulo que construíam `LessonSummary`/`LessonProgressRecord` por literal de objeto
  ganharam os campos novos (`null` — mecânico, sem mudança de comportamento). Validado com `docker
  compose up` real: migration aplica sem erro em cima do banco com as 33 lições já seedadas,
  `GET /lessons/:id` devolve os 2 campos como `null`, `POST /lessons/:id/progress` (avançar e
  concluir) continua funcionando idêntico a antes e `micro_decision_selected_option` permanece
  `null` na tabela (conferido via `psql` direto). 505 testes (+8 novos), lint/build passando.

### B.2 · Backend — `AdvanceLessonUseCase` grava a escolha ✅ concluída

- **Descrição:** `AdvanceLessonInput` (`backend/src/modules/lessons/application/useCases/advanceLesson.ts`)
  ganha um campo opcional `selectedOption?: number`, só relevante quando o `step` avançado é o da
  Micro-decisão (passo 1) de uma lição com `microDecisionOptions` preenchido. `upsertProgress`
  passa esse valor pra `microDecisionSelectedOption` (B.1). Validação de entrada com Zod
  (`advanceLessonBodySchema`, `backend/src/modules/lessons/interfaces/http/schemas.ts`) — índice
  dentro do tamanho de `microDecisionOptions` da lição, senão `400`.
- **O que muda na aplicação:** `advanceLesson.ts` (caso de uso), `schemas.ts` (Zod),
  `lessonsRouter.ts` (repassa o campo novo do body), `drizzleLessonRepository.ts` (persiste).
- **Critérios de aceite:** `POST /lessons/:id/progress` com `selectedOption` fora do intervalo de
  `microDecisionOptions.length` devolve `400`; com índice válido, persiste e é lido de volta em
  `GET /lessons` (currentStep/progress); lição sem opções reais ignora o campo sem erro (mantém
  checkbox).
- **Referências:** `.docs/backend/lessons.md`.
- **Dependências:** B.1.
- **Entregável:** `AdvanceLessonInput.selectedOption?: number`. Validação em 2 camadas, cada uma no
  lugar certo: Zod (`advanceLessonBodySchema`) só garante formato (`inteiro >= 0`), o caso de uso
  valida contra o `microDecisionOptions.length` real *daquela* lição (regra de negócio, não dá pra
  fazer isso num schema estático) — `InvalidMicroDecisionOptionError` novo (`domain/errors.ts`),
  mapeado pro `400` já existente no router (mesmo padrão dos outros erros de domínio). Lição sem
  `microDecisionOptions` (checkbox de hoje) nunca lança: o campo é só ignorado, sem chegar a persistir
  nada — critério de aceite "mantém checkbox" cumprido por omissão deliberada, não por caminho
  especial. Persistência reaproveita o encanamento condicional já pronto desde a B.1
  (`UpsertProgressInput.microDecisionSelectedOption`, `undefined` vs. `null`) — nenhuma mudança em
  `drizzleLessonRepository.ts` foi necessária, ao contrário do previsto no texto original da tarefa;
  só o caso de uso (que já tinha a lição carregada) precisou decidir *quando* incluir o campo no
  objeto passado a `upsertProgress`. **Achado confirmado com `docker compose up` real:** a escolha
  feita na chamada que sai do passo Micro-decisão sobrevive a uma chamada seguinte que avança até o
  Desbloqueio sem reenviar `selectedOption` — a lição completa (`step: 3`) manteve
  `micro_decision_selected_option = 0` gravado 1 chamada antes, provando que o design "omitir ≠
  apagar" da B.1 funciona no fluxo real de 2+ chamadas por lição, não só em teste unitário isolado.
  Testado o índice fora do intervalo (`400`), o índice válido (persiste e é lido de volta via
  `listProgressForUser`/`psql` direto) e a lição sem opções reais ignorando o campo — nos 3 níveis
  (caso de uso, router com supertest, `docker compose` ponta a ponta com uma lição real do seed
  temporariamente marcada com opções via SQL direto, já que a autoria de conteúdo é a B.4). 510
  testes (+5 novos), lint/build passando.

### B.3 · Frontend — widget de escolha real ✅ concluída

- **Descrição:** no passo Micro-decisão (`Lesson/index.tsx`, `step === 1`), quando
  `lesson.microDecisionOptions` não é `null`, renderizar N botões de escolha em vez do checkbox
  "já pensei" — mutuamente exclusivo com os widgets embutidos (`growth_calculator`/
  `fixed_income_comparison`, que continuam como estão). No passo Revelação (`step === 2`), se a
  lição tinha opções, abrir com um badge "Você acertou" (verde, `--color-gain-500`) ou "Quase — a
  resposta certa era: [opção]" (âmbar/neutro, nunca vermelho de perda financeira — RNF/identidade
  visual §2.3 reserva vermelho pra dado financeiro real) antes do `revelationText`.
- **O que muda na aplicação:** `Lesson/index.tsx` (novo bloco condicional no passo 1 e 2),
  `useAdvanceLesson.ts` (passa `selectedOption` na mutação), `services/lessons/types.ts` (espelha
  os 2 campos novos de `LessonSummary`). Os testes deste componente usam fixtures locais com
  `microDecisionOptions` preenchido — não dependem do conteúdo real da B.4 existir.
- **Critérios de aceite:** lição com opções reais mostra os botões (não o checkbox); escolher e
  continuar mostra o badge certo/quase correspondente na Revelação; lição sem opções continua
  mostrando o checkbox exatamente como hoje; teste de componente cobrindo os 2 casos (acerto e
  erro) + o caso sem opções (regressão).
- **Referências:** `identidade-visual-tokens.md` §2.3/2.3a (cores de feedback, não reaproveitar
  ganho/perda financeiro pra isso).
- **Dependências:** B.1, B.2.
- **Entregável:** estado local novo em `Lesson/index.tsx` (`selectedOption`), mutuamente exclusivo
  com o checkbox `microDecisionConfirmed` já existente — `hasRealOptions =
  lesson.microDecisionOptions != null` decide qual dos dois renderizar no passo Micro-decisão,
  igual ao padrão já usado pra `usesEmbeddedWidget`. `useAdvanceLesson` trocou a variável da
  mutation de `number` solto pra `{ step, selectedOption? }`; `services/lessons/advanceLesson`
  ganhou o 4º parâmetro opcional. **Achado de compatibilidade:** repassar `selectedOption` sempre
  (mesmo `undefined`) pra `services/lessons/advanceLesson` faria toda chamada existente virar 4
  argumentos em vez de 3 — quebraria os testes que já afirmam `toHaveBeenCalledWith(token, id,
  step)` com `toHaveBeenCalledWith` (compara também o tamanho do array de argumentos). Resolvido
  omitindo o argumento por completo (não passando `undefined`) tanto no service quanto no corpo da
  requisição, nos dois níveis (`useAdvanceLesson` → `advanceLesson` → `apiRequest` body) — nenhuma
  chamada sem aposta real muda de formato. Cor do badge "Você acertou" segue literalmente o texto
  da tarefa (verde, `--color-gain-500`) — exceção deliberada à regra geral de
  `identidade-visual-tokens.md` §2.3 ("nunca reaproveitar ganho/perda pra status de UI genérico"),
  já que é a própria tarefa fechada quem pede esse reaproveitamento neste caso específico. Badge
  "Quase" ficou neutro (`--color-text-secondary`/`--color-bg-surface-elevated`/`--color-border`),
  não âmbar — `--color-gamify-500` (o único tom âmbar/dourado já tokenizado) já carrega o
  significado forte de "conquista/XP" no resto do app, e reusá-lo pra "você errou" colidiria com
  essa semântica; nenhum token novo foi criado. Cópia "Quase — a resposta certa era: [opção]" do
  texto original da tarefa reescrita sem travessão pra "Quase. A resposta certa era: [opção]"
  ([[feedback-no-em-dash-ui-text]] — regra do usuário, texto de UI nunca leva travessão; documentos
  como o próprio backlog podem, texto renderizado não). Sem CSS por breakpoint: a lista de botões é
  `flex-direction: column` simples, funciona idêntica nos 3 tamanhos porque o card já é coluna
  única de largura máxima 720px (mobile não esticado nem comprimido, já era assim antes desta
  tarefa). Efeito colateral mecânico: `Lesson`/`LessonSummary` ganharam os 2 campos em mais 13
  arquivos de teste do frontend que constroem `Lesson` por literal (mesmo custo já visto na B.1 do
  lado do backend). Testado com fixtures locais (`microDecisionOptions: ['Sim', 'Não']`), sem
  depender da B.4: 5 testes novos (botões aparecem em vez do checkbox, `Continuar` desabilitado até
  escolher, acerto envia `selectedOption` e mostra "Você acertou", erro mostra "Quase" com a opção
  certa, lição sem opções não mostra nenhum dos dois badges). Validado com `docker compose up` +
  dev server + Chrome real: uma lição do seed (0.1) marcada temporariamente com opções via SQL
  direto (autoria de conteúdo real é a B.4), os dois badges conferidos com 2 usuários distintos
  (acerto e quase), `POST /lessons/:id/progress` persistindo o índice certo em
  `micro_decision_selected_option` (conferido via `psql`), e o layout mobile (390px, iframe
  injetado por JS — `resize_window` ficou dessincronizado de novo nesta sessão, mesma classe de
  problema já vista em G.2/I.3) confirmando a lista de botões cheia largura + `TabBar` inferior
  intactos. 611 testes (+5 novos), lint/tsc/prettier passando.

### B.4 · Conteúdo — auditoria e autoria das opções ✅ concluída

- **Descrição:** levantar, das 33 lições `reflection`, quantas têm resposta objetiva clara
  (sim/não, sobe/desce, maior/menor — a maioria, pelo padrão já visto em 1.1, 1.2, 1.6, 2.5, 2.6.x)
  vs. as que são genuinamente abertas/reflexivas sem "resposta certa" (raras, mas existem — ex.
  0.1 "o que te faria escolher um ou outro" é aberta de propósito, não deveria virar múltipla
  escolha forçada). Escrever `microDecisionOptions`/`microDecisionCorrectOption` só pras
  elegíveis.
- **O que muda na aplicação:** só `backend/src/db/seedLessons.ts` (dados) + `db:seed:lessons`.
- **Critérios de aceite:** tabela de auditoria (pode ficar como comentário no próprio seed, mesmo
  padrão de outras decisões documentadas ali) listando quais das 33 ganharam opções reais e quais
  ficaram deliberadamente abertas, com justificativa curta pras que ficaram de fora.
- **Referências:** `proposta-engajamento-licoes.md` §3.
- **Dependências:** B.1, B.3 (widget já implementado, testado com fixture — B.4 é quem finalmente
  valida com conteúdo real de ponta a ponta).
- **Entregável:** **achado de auditoria que corrige o texto original da tarefa:** o critério de
  elegibilidade não é `microDecisionType === 'reflection'` — é "o passo Micro-decisão hoje mostra o
  checkbox", que também cobre as 6 lições `live_indicator` (2.6.1–2.6.6), já que
  `EMBEDDED_WIDGET_TYPES` (B.3) só exclui `growth_calculator`/`fixed_income_comparison`. Com esse
  critério corrigido: **30 das 33** lições ganharam `microDecisionOptions`/
  `microDecisionCorrectOption` reais; só 3 ficaram de fora — `0.1` (pergunta sobre motivação
  pessoal, "o que te faria escolher", sem fato verificável — o próprio exemplo citado no texto
  original da tarefa), `0.2`/`3.3` (`growth_calculator`/`fixed_income_comparison`, o widget
  embutido já é a interação). Tabela de auditoria completa (as 3 de fora com justificativa + índice
  da opção correta das 30 elegíveis) em comentário no próprio `seedLessons.ts`, logo antes de
  `LESSON_SEEDS`. A maioria das opções reaproveita literalmente o vocabulário que o próprio
  `microDecisionPrompt` já enumera em texto (`sobe/cai/fica igual`, `maior/menor`, `sim/não`) — sem
  inventar redação nova. Duas exceções combinam duas leituras numa opção só, porque a pergunta
  original já pede as duas juntas: `2.3` (par ON/PN de VALR3+BNDD4) e `3.4` (efeito nos fundamentos
  + o que acontece com o Tesouro Selic, desafio final da trilha sintetizando 2.8+3.2 — 4
  combinações possíveis, só uma bate com `revelationText`). `main()` (função de seed) ganhou os 2
  campos novos no `onConflictDoUpdate.set` (estavam faltando — sem isso, rodar o seed de novo nunca
  atualizaria uma lição já existente com as opções novas, só inseriria lição nova). Validado com
  `docker compose up` real: reseed sobre o banco já populado confirmou `30` lições com
  `micro_decision_options IS NOT NULL` e `3` com `NULL` via `psql` direto (bateu exato com a
  contagem da auditoria); `GET /lessons` devolvendo o conteúdo real; e Chrome real percorrendo a
  lição `0.3` de ponta a ponta com o conteúdo genuíno (não fixture) — 4 opções numéricas (`R$95`
  `R$100` `R$105` `R$110`), escolher a certa (`R$105`) mostrou "Você acertou" com o `revelationText`
  real embaixo. Fase B (aposta com acerto/erro real) está **encerrada** — B.1 a B.4 todas concluídas.
  510 testes backend / 611 frontend, lint/build/tsc/prettier passando nos dois lados.

---

## Fase C — Glossário inline e elenco recorrente

Impulsos 4/5 indiretos (reduz retrabalho de leitura, dá continuidade). Sem migration.

### C.1 · Catálogo de glossário + popover de definição ✅ concluída

- **Descrição:** catálogo estático (mesmo espírito de `engine/internal/domain/macroevent/templates.go`
  — dado fixo em código, não tabela de banco) termo → definição curta, cobrindo os termos
  recorrentes hoje reexplicados por extenso em mais de uma lição (FGC, marcação a mercado,
  deságio, taxa bruta equivalente, EBIT, Dividend Yield...). Componente novo (`molecule`,
  `frontend/src/components/molecules/GlossaryTerm/`) marca o termo com sublinhado tracejado;
  toque/hover mostra a definição num popover pequeno, sem navegar pra fora da lição. **Convenção
  de marcação:** termo entre chaves duplas no texto, ex. `{{FGC}}` — o parser da A.1 reconhece
  esse padrão em qualquer cartão e substitui pelo componente `GlossaryTerm` na renderização; termo
  usado que não existe no catálogo cai de volta pro texto puro (`{{Termo}}` → `Termo`), nunca
  quebra a tela.
- **O que muda na aplicação:** catálogo novo em `frontend/src/features/lessons/glossary.ts` (mapa
  `Record<string, string>` termo→definição, testado), componente `GlossaryTerm` (molecule),
  marcação nos textos de `seedLessons.ts` usando a convenção `{{Termo}}`.
- **Critérios de aceite:** termo marcado no texto renderiza com o popover funcional; termo `{{X}}`
  sem entrada no catálogo renderiza só o texto `X`, sem quebrar; teste do componente cobrindo
  abrir/fechar do popover e navegação por teclado (Enter/Escape).
- **Referências:** `proposta-engajamento-licoes.md` §2 (técnica "Glossário inline").
- **Dependências:** A.1 (mesmo pipeline de parsing do texto).
- **Entregável:** catálogo em `frontend/src/features/lessons/glossary/index.ts` (6 termos: FGC,
  marcação a mercado, deságio, taxa bruta equivalente, EBIT, Dividend Yield — módulo em pasta, não
  arquivo solto, pra seguir a convenção de `components/`/`features/*` do CLAUDE.md), parser puro
  `frontend/src/features/lessons/parseGlossaryTerms/` (regex `{{...}}` → segmentos `text`/`term`,
  testado incluindo fallback de termo ausente no catálogo) e molecule
  `frontend/src/components/molecules/GlossaryTerm/` (popover próprio, não `title` nativo — abre em
  clique/toque e hover, fecha em mouse saindo, blur, clique fora ou Escape; testado). `Lesson/
  index.tsx` (`CardBody`) troca `{card.text}` por `renderGlossaryText(card.text)`, que devolve os
  segmentos de texto como string solta (não `<span>`) especificamente pra não quebrar
  `getByText` nos testes já existentes que buscam o texto completo de um cartão sem termo marcado
  (`getNodeText` do Testing Library só junta os `TEXT_NODE` filhos diretos do elemento, não o
  `textContent` recursivo). Marcação `{{Termo}}` aplicada em `backend/src/db/seedLessons.ts` nos
  pontos de referência recorrente (1.3/1.5/1.9 pro FGC, 1.2 pra marcação a mercado, 1.7 pro
  deságio, 1.5 pra taxa bruta equivalente, 2.6.5 pro EBIT, 2.7/2.10 pro Dividend Yield) — não nas
  lições que são a própria aula do termo (1.6, 1.7, 2.6.1–2.6.6), pra não competir com a explicação
  didática de primeira exposição. Validado ponta a ponta via `docker compose up` + reseed
  (`npm run db:seed:lessons`) e Chrome: popover abre com a definição certa na Revelação da lição
  1.3. `npm test`/`npm run lint`/`npm run build` passam no frontend e no backend.

### C.2 · Elenco recorrente — referência cruzada entre lições ✅ concluída

- **Descrição:** VALR3/BNDD4 (e os demais tickers do catálogo) aparecem em 8+ lições da Trilha 2
  como exemplos soltos. Adicionar, no texto de uma lição que reintroduz um ativo já visto, um link
  curto "já visto na lição 2.1" navegando direto pra ela (`/trilha/:id`), em vez de reexplicar do
  zero.
- **O que muda na aplicação:** conteúdo (`seedLessons.ts`) usando a mesma convenção de marcação da
  C.1 (ex. `{{ref:2.1}}` → link "já visto na lição 2.1", resolvido no parser de A.1 pro `id` real
  via a lista de lições já carregada em `useLessonsQuery`, sem chamada nova).
- **Critérios de aceite:** pelo menos 3 lições da Trilha 2 (ex: 2.4, 2.6.3, 2.8, todas
  reintroduzindo VALR3/BNDD4) linkam de volta pra 2.1/2.3, onde o ativo foi apresentado primeiro.
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 1, "elenco recorrente").
- **Dependências:** A.1 (reaproveita o parser/convenção de marcação — unificado com C.1 nesta
  revisão pra não ter 2 sintaxes de marcação diferentes no mesmo texto).
- **Entregável:** parser de C.1 renomeado de `parseGlossaryTerms` pra `parseLessonMarkup`
  (`frontend/src/features/lessons/parseLessonMarkup/`, mesma pasta, só o nome muda — deixou de ser
  só sobre glossário) e estendido com um terceiro tipo de segmento, `ref` (`{{ref:X.Y}}` → `{ type:
  'ref', code: 'X.Y' }`), na mesma regex `{{...}}` da C.1 — sem sintaxe nova. O parser continua sem
  depender de dado de rede: só devolve o `code` citado; `Lesson/index.tsx` (`renderLessonMarkup`,
  renomeada de `renderGlossaryText`) resolve `code` → `id` real usando a lista de `useLessonsQuery`
  já carregada e renderiza um `<Link to="/trilha/:id">já visto na lição X.Y</Link>` (classe
  `.refLink`, sublinhado sólido — contraste deliberado com o tracejado do `GlossaryTerm`, que só
  abre um popover e não navega). Código sem lição correspondente na lista (`lessons.find` sem
  match) cai pro texto puro `já visto na lição X.Y`, sem link e sem quebrar, mesma garantia da C.1.
  Marcação aplicada nas 3 lições sugeridas pelo critério de aceite — 2.4, 2.6.3 e 2.8 — sempre
  linkando VALR3 de volta pra 2.1 e BNDD4 pra 2.3 (onde cada um foi apresentado primeiro, conferido
  lendo o texto das duas: 2.1 é a lição inteira sobre VALR3 como exemplo de "o que é uma ação", 2.3
  é onde BNDD4 ganha nome completo e explicação própria de ON/PN, embora citado de passagem já na
  2.2). Testado (parser: segmento `ref` isolado e junto de um `term` no mesmo texto; `Lesson`: link
  renderizado com `href` correto quando a lição existe na lista, fallback em texto puro quando não
  existe). Validado ponta a ponta via `docker compose up` + reseed e Chrome: os dois links aparecem
  formatados na Micro-decisão da lição 2.4 e clicar em "já visto na lição 2.1" navega de fato pra
  lição 2.1 (reabre no Desbloqueio porque já estava concluída nesta sessão de teste — comportamento
  existente de "modo revisão", não relacionado a esta tarefa). `npm test`/`npm run lint`/`npm run
  build` passam no frontend e no backend.

---

## Fase D — Blocos tipados + XP fracionado

**Gate explícito, não uma tarefa de código ainda.** A versão anterior deste backlog deixava os
critérios de aceite "a decidir na sessão que abrir esta tarefa" — foi corrigido: D.0 abaixo é a
própria tarefa de decisão, com critério de aceite concreto (um documento, não código). D.1/D.2 só
começam depois de D.0 concluir com resultado "seguir".

### D.0 · Checkpoint de decisão — vale a pena ir além do fatiamento por texto?

- **Descrição:** depois de A-C estarem em produção por tempo suficiente pra gerar sinal (não uma
  sessão logo em seguida — dias/semanas de uso real), responder por escrito: (1) o tempo médio por
  lição mudou (seção "Como validar" da proposta)? (2) a taxa de acerto na Micro-decisão (Fase B)
  está numa faixa saudável (nem perto de 100%, nem muito baixa)? (3) existe alguma comparação ou
  fórmula que o formato "texto com `\n\n`" (A.1) não consegue expressar bem, que blocos tipados
  resolveriam? Se a resposta de (3) for "não", **não fazer D.1** — só a variação de XP (D.2) ainda
  vale, independente do resto.
- **O que muda na aplicação:** nada em código — o entregável é o documento de decisão (pode virar
  uma atualização deste próprio arquivo, seção D, com o resultado).
- **Critérios de aceite:** as 3 perguntas acima respondidas por escrito, com dado real (não
  achismo) sustentando a resposta; decisão explícita de seguir ou não pra D.1.
- **Referências:** `proposta-engajamento-licoes.md` §6 ("Como validar").
- **Dependências:** A.1, A.2, A.3, B (rodando em produção real, não só implementadas).

### D.1 · Conteúdo estruturado por blocos tipados

- **Descrição:** evolução da A.1 (`\n\n` como delimitador de string) pra uma lista de blocos
  tipados de verdade — `{ type: 'text' | 'formula' | 'comparison' | 'glossary_ref', ... }`. Só
  abrir esta tarefa se D.0 concluiu com "seguir".
- **O que muda na aplicação:** migration em `lessons` trocando os 3 campos de `text` por `jsonb`
  (ou 3 novos campos `*Blocks jsonb`, mantendo os antigos até a migração de conteúdo terminar);
  `domain/lesson.ts` ganha os tipos de bloco; `Lesson/index.tsx` renderiza por tipo de bloco em
  vez de só split de string.
- **Critérios de aceite:** definidos na própria D.0, como parte do documento de decisão (não
  antes) — a resposta à pergunta 3 de D.0 já aponta qual tipo de bloco resolve qual problema
  concreto, e isso vira o critério de aceite desta tarefa.
- **Referências:** `proposta-engajamento-licoes.md` §2 ("nova arquitetura de passos").
- **Dependências:** D.0 (resultado "seguir").

### D.2 · XP variável por desempenho

- **Descrição:** `LESSON_XP_REWARD` hoje é flat (50, `domain/lesson.ts`). Variar o valor premiado
  por `xpAwarder.award` conforme o desempenho na Micro-decisão (acerto de primeira > acerto depois
  de errar > sem aposta real ainda, lições não migradas pela B mantêm o flat de hoje). Recalibração
  de toda a curva (não só das lições) é a tarefa 8.1, já prevista antes desta sessão — esta tarefa
  não reabre 8.1 sozinha, só adiciona a variável "desempenho" ao que 8.1 vai calibrar. Não depende
  de D.0/D.1 — pode ser feita mesmo que blocos tipados nunca aconteçam.
- **O que muda na aplicação:** `AdvanceLessonUseCase` calcula o valor a premiar antes de chamar
  `xpAwarder.award` (hoje chama com a constante direto); `domain/lesson.ts` ganha a função pura de
  cálculo, testada table-driven.
- **Critérios de aceite:** lição sem aposta real premia os mesmos 50 XP de hoje (sem regressão);
  lição com aposta real premia mais por acerto de primeira que por completar sem acertar.
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 2); comentário já existente em
  `domain/lesson.ts` sinalizando a calibração da 8.1.
- **Dependências:** B (aposta real precisa existir pra ter "desempenho" a medir). Independente de
  D.0/D.1.

---

## Fase E — Arco narrativo por trilha

Impulso 1 (Significado épico). Só conteúdo, zero schema, pode ser feita em paralelo com qualquer
outra fase.

### E.1 · Reescrita das lições-âncora com o "porquê" da trilha ✅ concluída

- **Descrição:** reescrever `scenarioText` da primeira lição de cada trilha (0.1, 1.1, 2.1, 3.1) pra
  plantar uma meta maior que a trilha inteira resolve aos poucos, e `unlocksDescription` da última
  lição de cada trilha (0.5, 1.9, e a última de 2/3 quando existirem) pra pagar essa promessa
  explicitamente. Ex.: Trilha 1 inteira enquadrada como "montar sua reserva de emergência antes de
  um imprevisto", ecoando o cenário do bônus de R$1.000 já usado em 0.1.
- **O que muda na aplicação:** só `backend/src/db/seedLessons.ts` (conteúdo) + `db:seed:lessons`.
- **Critérios de aceite:** as 4 lições de abertura de trilha (0.1/1.1/2.1/3.1) citam
  explicitamente uma meta que só se completa no fim da trilha; a última lição de cada trilha já
  autorada (0.5, 1.9) referencia essa meta ao fechar.
- **Entregável:** `scenarioText` de 0.1/1.1/2.1/3.1 ganhou uma frase plantando a meta da trilha,
  preservando o texto/números originais. Trilha 0: "por que o destino automático desse tipo de
  dinheiro (a poupança) geralmente deixa valor na mesa" (0.1), pago em 0.5. Trilha 1: "montar uma
  reserva de emergência de verdade... e sair dela sabendo em qual produto colocá-la" (1.1),
  ecoando o bônus de R$1.000 de 0.1 explicitamente, pago em 1.9. Trilha 2: "com a reserva de
  emergência da Trilha 1 já resolvida, esta trilha é sobre o resto do patrimônio" (2.1), pago em
  2.10. Trilha 3: "fecha o arco das duas anteriores: juntar a reserva segura (Trilha 1) e a parte
  de risco (Trilha 2) numa única estratégia, e testar essa estratégia contra um evento de mercado
  real" (3.1), pago em 3.4 (já tinha o desfecho estrutural pronto — só reforçado). `unlocksDescription`
  de 0.5/1.9/2.10/3.4 (todas as 4 trilhas já estavam autoradas, não só 0.5/1.9 como o texto original
  da tarefa previa como incerto) reescrito pra pagar a meta plantada: "Confirmação de que a
  poupança perde da Selic..." (0.5), "Sua reserva de emergência com todas as opções na mesa..."
  (1.9), "O resto do patrimônio com onde crescer..." (2.10), "Estratégia completa e testada contra
  um evento real..." (3.4) — cada uma mantendo o texto funcional original (o que a lição libera de
  fato) como sufixo, já que `unlocksDescription` é reaproveitado como rótulo curto em `Track`/
  `TrackChart` (`Bloqueada: libera ${unlocksDescription}`), não só no passo Desbloqueio da lição.
  Nenhum em-dash usado (regra de convenção de texto de UI). Validado com `docker compose up -d
  postgres` + migração + `db:seed:lessons` reais, conferindo as 8 strings no banco via `psql`.
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 1); spec 5.1 (tabela de lições por
  trilha, coluna "Conceito central").
- **Dependências:** nenhuma.

---

## Fase F — Posse: sala de troféus no Perfil

Impulso 4. **Corrigida nesta revisão:** a versão anterior assumia dar pra consumir `GET /lessons`
pra mostrar trilhas concluídas no Perfil Público — não dá, essa rota só lê
`req.auth.userId` (confirmado em `lessonsRouter.ts`), nunca o `userId` de outra pessoa. Precisa de
campo novo em `GetPublicProfileUseCase`. Sem tocar em RNF09 (nenhum valor absoluto exposto —
emblema mostra conquista, não patrimônio).

### F.1 · Tokens de cor por trilha ✅

- **Descrição:** `identidade-visual-tokens.md` hoje não distingue trilhas por cor. Definir uma
  variação de tom por trilha (4 trilhas: 0 Fundamentos, 1 Renda Fixa, 2 Renda Variável, 3
  Estratégia) dentro da paleta já existente, sem introduzir hue novo que não seja
  marca/gamificação/semântico (regra §1 do doc de tokens — "cor forte com intenção").
- **O que muda na aplicação:** `identidade-visual-tokens.md` (seção nova, "cor por trilha") +
  `:root` custom properties correspondentes no frontend.
- **Critérios de aceite:** 4 tons definidos, cada um com contraste AA sobre `--color-bg-surface`
  nos dois temas (claro/escuro); documentado no arquivo de tokens antes de qualquer componente
  usar.
- **Referências:** `identidade-visual-tokens.md` §1-2.
- **Dependências:** nenhuma.
- **Entregável:** seção 2.6 nova em `identidade-visual-tokens.md` com `--color-track-0`
  (Fundamentos, hue de marca), `--color-track-1` (Renda Fixa, hue de ganho), `--color-track-2`
  (Renda Variável, hue de perda) e `--color-track-3` (Estratégia, hue de gamificação) — token 0 e 2
  reaproveitam o hex exato de `--color-brand-300`/`--color-loss-500` (mesmo padrão da 2.3a); token
  1 e 3 usam um tom mais escuro que o `-500` de origem só no tema claro, porque o valor original
  fica em ~3.45:1/~3.64:1 contra `--color-bg-surface` branco (abaixo do AA de texto normal 4.5:1).
  Contraste de todos os 8 valores (4 tons × 2 temas) calculado via fórmula de luminância relativa
  do WCAG 2 — pior caso 4.60:1 (track 2 dark), todos os outros ≥5.36:1. Fundo suave do emblema fica
  pra quando F.3 precisar (reaproveita `-100` da família de origem, sem token novo). Custom
  properties espelhadas em `frontend/src/index.css` (`:root` e `:root[data-theme='light']`). Sem UI
  nova nesta tarefa (nenhum componente consome os tokens ainda — isso é F.3).

### F.2 · Backend — trilhas concluídas no perfil público ✅

- **Descrição:** `GetPublicProfileUseCase` (`backend/src/modules/profile/application/useCases/getPublicProfile.ts`)
  hoje monta `PublicProfile` a partir de 3 leitores (`gamificationReader`, `achievementsReader`,
  `profitabilityReader`) — nenhum deles sabe de lições. Acrescentar
  `completedTracks: number[]` ao tipo `PublicProfile`, via um 4º leitor novo
  (`TrackCompletionReader`, porta declarada em `profile/application/ports/`, mesmo padrão dos
  outros 3) implementado por um adapter em processo sobre o repositório de `lessons` (mesma
  direção de dependência de `productUnlockReader`/`lessonCompletionChecker`, que já atravessam
  módulo assim).
- **O que muda na aplicação:** `profile/application/ports/trackCompletionReader.ts` (novo);
  `profile/infrastructure/lessons/inProcessTrackCompletionReader.ts` (novo adapter);
  `getPublicProfile.ts` (chama o 4º leitor, acrescenta o campo); composição em `app.ts` liga o
  adapter novo.
- **Critérios de aceite:** `GET /users/:id/profile` de um usuário que completou a Trilha 1 devolve
  `completedTracks: [0, 1]` (ou equivalente); usuário sem nenhuma trilha completa devolve `[]`;
  nenhum campo de patrimônio absoluto adicionado (RNF09 — teste explícito, não só ausência
  incidental, mesmo cuidado já usado em `GetPublicProfileUseCase` hoje).
- **Referências:** `.docs/backend/profile.md` (contrato de `GET /users/:id/profile`); RNF09.
- **Dependências:** nenhuma.
- **Entregável:** o adapter acabou sobre um caso de uso novo de `lessons`
  (`GetCompletedTracksUseCase`), não direto sobre o repositório — mesmo padrão já usado por
  `productUnlockReader`/`lessonCompletionChecker` (ambos também envolvem um caso de uso de
  `lessons`, não a porta crua). Função pura `completedTrackNumbers` em `lessons/domain/lesson.ts`
  (trilha só entra no resultado se **todas** as lições dela tiverem `completedAt` preenchido).
  `GetCompletedTracksUseCase` existe porque `GET /lessons`/`GetTrackMapUseCase` só serve
  `req.auth.userId` — o caso de uso novo aceita `userId` de entrada e nunca passa pela rota HTTP,
  chamado só em processo pelo adapter `createInProcessTrackCompletionReader` (mesma direção de
  `inProcessAchievementsReader`/`inProcessProductUnlockReader`). `PublicProfile.completedTracks`
  populado via `Promise.all` junto dos outros 3 leitores. Testes: `lesson.test.ts` (função pura),
  `getCompletedTracks.test.ts` (caso de uso, fake de `lessonRepository`), `getPublicProfile.test.ts`
  + `profileRouter.test.ts` (fake novo `fakeTrackCompletionReader`, RNF09 sem alteração — teste
  explícito de chaves proibidas continua passando). Validado ponta a ponta via `docker compose up`
  real (não só teste): registrou 2 usuários, completou as 5 lições da Trilha 0 pra um deles via
  `POST /lessons/:id/progress`, confirmou `completedTracks: [0]` tanto em `/me/profile` quanto em
  `/users/:id/profile` visto pelo *outro* usuário (o caso que `GET /lessons` não cobria) e `[]` pro
  usuário sem nenhuma lição concluída.

### F.3 · Organism `TrackTrophyCase` no Perfil ✅

- **Descrição:** seção nova na tela de Perfil Público mostrando um emblema visual por trilha
  concluída (dado de F.2), na cor definida em F.1 — substitui/complementa a conquista genérica
  "Formado na Trilha" (hoje só um item a mais na grade de conquistas, `AchievementsGrid`) por algo
  visualmente distinto por trilha.
- **O que muda na aplicação:** `frontend/src/components/organisms/TrackTrophyCase/` (novo,
  `index.tsx`/`index.module.css`/`index.test.tsx`), consumido pela página de Perfil Público
  (`PublicProfileCard`, que ganha `completedTracks` em `PublicProfileCardProps`, espelhando o
  campo novo de F.2).
- **Critérios de aceite:** usuário com 1+ trilha concluída vê o emblema correspondente na cor
  certa; usuário sem nenhuma trilha concluída não vê a seção vazia (nem quebrada) — mesmo padrão
  de estado vazio já usado em outras telas do app.
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 4); RF20 (Perfil Público).
- **Dependências:** F.1, F.2.
- **Entregável:** `completedTracks: number[]` acrescentado a `PublicProfile`
  (`services/profile/types.ts`) — decisão desta sessão: o campo entra dentro do objeto `profile`
  já existente (espelhando 1:1 a resposta real do backend), não como prop irmã separada em
  `PublicProfileCardProps` como o texto original da tarefa sugeria, porque toda a informação de
  perfil já flui assim (`profile.achievements`, `profile.profitabilityPct` etc.) — introduzir uma
  prop paralela seria duplicar o mesmo dado por dois caminhos. Nome/cor por trilha (currículo fixo
  de 4 trilhas, spec 5.1) vivem como constante estática dentro do próprio
  `TrackTrophyCase/index.tsx` — a API só devolve o número, nunca o nome. Sem estado "bloqueado" pra
  desenhar (diferente de `AchievementsGrid`): só a trilha concluída existe; `completedTracks: []`
  → componente retorna `null` (mesmo padrão de `ResumeLessonCard`/`TrackChart`/`GrowthChart`, nunca
  um "nenhuma trilha concluída" vazio). Ícone `GraduationCap` (não `Trophy` — já é o ícone da aba
  Classificação na `TabBar`, evitar reuso ambíguo). Cor/borda/ícone/texto do emblema usam um único
  `color` inline (currentColor) em vez de repetir a variável 3x. Grid responsivo mobile-first: 2
  colunas base, 4 a partir de 768px, 1 coluna abaixo de 380px (nome mais longo, "Estratégia e
  Tributação") — mesmos breakpoints e mesma correção de nome longo já usados em
  `AchievementsGrid`. Validado com `docker compose up` + dev server reais no Chrome: emblema azul
  "Fundamentos" aparece na cor/fundo certos (`--color-track-0`/`--color-brand-100`, conferido via
  `getComputedStyle`) tanto em dark quanto light, seção some por completo pro usuário sem trilha
  concluída, grid confirmado em 4 colunas no desktop e regras de mídia de 768px/380px presentes no
  CSS computado (mesmas do `AchievementsGrid` já testado). Testes: `index.test.tsx` novo
  (`TrackTrophyCase`) + fixtures de `PublicProfile` atualizadas em
  `PublicProfileCard`/`PerfilPublico`/`MeuPerfil`.

---

## Fase G — Feed social de aprendizado

Impulso 5. **Corrigida nesta revisão:** a versão anterior descrevia isso como "novo tipo de evento
num feed de amizade já existente" — não existe nenhum feed de atividade hoje (confirmado:
`frontend/src/pages/Amigos` é um hub de contador + lista, `BuscarAmigos` é busca; nenhum dos dois
lista eventos). As duas tarefas abaixo criam essa peça do zero, não estendem algo pronto. RNF09 e
o ranking (RF17/RF19) continuam intocados: nenhum dado de rentabilidade ou patrimônio entra nesse
evento.

### G.1 · Backend — evento "amigo completou a trilha" ✅ concluída

- **Descrição:** quando `AdvanceLessonUseCase` completa a última lição de uma trilha (mesmo ponto
  que hoje já desbloqueia a trilha seguinte via `sortOrder`), gravar um evento de atividade
  consumível pelos amigos do usuário — só o fato "completou a Trilha X", nada de rentabilidade,
  patrimônio ou XP absoluto. Tabela nova (decisão fechada nesta revisão, não em aberto):
  `social_feed_events` (`id`, `user_id`, `type` — só `'track_completed'` por agora, mas coluna
  `text` pra caber tipo futuro sem migration nova —, `track_number`, `occurred_at`).
- **O que muda na aplicação:** módulo novo `socialfeed` (DDD lite, mesmo padrão dos demais:
  `domain/`, `application/useCases/recordTrackCompleted.ts` + `listFeedForUser.ts`,
  `infrastructure/persistence/`), consumido por `lessons` via porta
  (`application/ports/socialFeedRecorder.ts` em `lessons`, adapter em processo — mesmo padrão de
  `inProcessLessonCompletionChecker` já usado entre `missions` e `lessons`); migration da tabela
  nova.
- **Critérios de aceite:** completar a última lição de uma trilha grava 1 evento; usuário sem
  amigos aceitos não gera ruído pra ninguém (a consulta de leitura já filtra por amizade
  aceita); nenhum campo de patrimônio no evento (teste explícito).
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 5); RNF09; spec seção 8 (sistema
  de amigos).
- **Dependências:** nenhuma.
- **Entregável:** migration `0012_lame_tomas.sql` (tabela `social_feed_events`, `type` texto livre,
  `track_number` nullable — ambos deliberados, pra caber tipo futuro sem migration nova). Módulo
  novo `socialfeed` (DDD lite completo: `domain/socialFeedEvent.ts`,
  `RecordTrackCompletedUseCase`/`ListFeedForUserUseCase`, ports `SocialFeedEventRepository`/
  `FriendGraphReader`/`UserDirectory` com adapters Drizzle + `inProcessFriendGraphReader` sobre
  `friendships`, router `GET /social-feed`). Achado de implementação: `AdvanceLessonUseCase` nunca
  soube "esta é a última lição da trilha" antes desta tarefa (progressão é só via `sortOrder`
  global) — resolvido comparando `completedTrackNumbers` (já existente, `domain/lesson.ts`, F.2)
  antes/depois da escrita de `upsertProgress`, sem precisar de coluna nova nem de duplicar a regra
  de "trilha completa". `lessons` consome `socialfeed` via port própria
  (`application/ports/socialFeedRecorder.ts`), mesmo padrão de `xpAwarder`/`streakTracker` — direção
  de dependência invertida do padrão usual (`missions`/`market`/`profile` consomem `lessons`; aqui é
  `lessons` quem consome outro módulo), documentada em `.docs/backend/lessons.md` como "chamada de
  saída". `.docs/backend/socialfeed.md` criado. Validado com `docker compose up` real de ponta a
  ponta (não só teste): 2 usuários, amizade aceita, 5 lições da Trilha 0 completadas por um deles via
  `POST /lessons/:id/progress` — exatamente 1 linha gravada em `social_feed_events` (confirmado via
  `psql` direto, não só pela resposta HTTP), evento aparece em `GET /social-feed` do amigo aceito e
  não aparece pro próprio usuário que completou (que não tem amigo completando nada). Suíte inteira
  (485 testes, incluindo os novos deste módulo) e lint/build passando.

### G.2 · Frontend — seção de atividade recente em `/amigos` ✅ concluída

- **Descrição:** nova seção "Atividade recente" na própria tela `Amigos`
  (`frontend/src/pages/Amigos/index.tsx`, hub já existente — decisão fechada nesta revisão: não é
  uma rota nova) listando os eventos de G.1 dos amigos aceitos do usuário
  ("🎓 [amigo] completou a Trilha 1: Renda Fixa"), tom de celebração — sem número nenhum ao lado.
- **O que muda na aplicação:** `Amigos/index.tsx` ganha a seção nova + hook de query
  (`features/socialfeed/useFeedQuery.ts`) consumindo o endpoint novo de G.1.
- **Critérios de aceite:** evento aparece na seção pros amigos do usuário que completou a trilha;
  usuário sem amigos vê a seção com estado vazio (não quebrada, não escondida); nenhum dado
  numérico sensível visível.
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 5).
- **Dependências:** G.1.
- **Entregável:** `services/socialfeed/` (`getSocialFeed`, espelha `.docs/backend/socialfeed.md`) +
  `features/socialfeed/useFeedQuery/` (TanStack Query, mesmo padrão de `useAchievementsQuery`) +
  organism novo `components/organisms/RecentActivityFeed/` (ícone `GraduationCap` — mesmo emblema de
  `TrackTrophyCase`, F.3 —, nome/cor de trilha como dado estático local pela mesma razão de F.3: o
  endpoint só devolve `trackNumber`). `Amigos/index.tsx` renderiza a seção logo abaixo do header, só
  depois que `feedQuery.data` chega (sem flash de estado vazio antes da resposta real); estado vazio
  e populado ficam dentro do próprio organism. Sem paginação — `GET /social-feed` já limita a 20
  entradas. Mobile-first: linha da atividade quebra em 2 linhas (`<768px`, data desce pra segunda
  linha com indentação alinhada ao texto) e vira 1 linha inteira a partir de 768px, mesmo padrão de
  `FriendsList`. Validado com `docker compose up` real de ponta a ponta: 2 usuários novos, amizade
  aceita, 5 lições da Trilha 0 completadas por um deles via `POST /lessons/:id/progress`, evento
  aparece na seção do amigo aceito ("Bob G2 completou a Trilha 0: Fundamentos") em telas
  desktop e mobile (390px, via iframe — a extensão de automação do browser não respeitou o resize da
  janela nesta sessão), sem paginação/rentabilidade/patrimônio visível. Suíte inteira (585 testes,
  incluindo os 3 novos deste organism/página) e lint/build/tsc passando.

---

## Fase H — Revisão, missões e conquistas por qualidade

Impulsos 3/6/7/8. Estende os catálogos hoje 100% baseados em volume (`achievement_criteria_type`:
`net_worth`, `streak_days`, `lessons_completed`, `trades_executed`) com critérios de qualidade de
aprendizado.

### H.1 · Extensão do enum `achievement_criteria_type`

- **Descrição:** adicionar 3 valores ao enum Postgres `achievement_criteria_type`:
  `micro_decisions_streak` (sequência de acertos seguidos), `track_completed_no_errors` (trilha
  inteira sem nenhum erro na aposta), `lesson_reviewed` (revisitar voluntariamente uma lição já
  concluída). **Cuidado técnico:** `ALTER TYPE ... ADD VALUE` no Postgres não pode rodar dentro da
  mesma transação que um `INSERT` usando o valor novo em algumas versões — separar a migration de
  schema do seed de conquistas novas (`seedAchievements.ts`) em dois passos/migrations, não uma
  transação só.
- **O que muda na aplicação:** migration nova; `ProgressSnapshot`
  (`backend/src/modules/achievements/domain/achievement.ts`) ganha os 3 campos numéricos
  correspondentes (contagem de acertos seguidos atual, contagem de trilhas completadas sem erro,
  contagem de revisões voluntárias); o adapter que implementa `ProgressSnapshotReader` (hoje
  agrega 3 fontes — gamification/lessons/ranking) passa a agregar uma 4ª leitura sobre
  `microDecisionSelectedOption`/`microDecisionCorrectOption` (B.1); `progressValueFor`/
  `isSatisfied` (`achievement.ts`) não mudam de assinatura — só ganham mais 3 `case` no mapeamento
  criteriaType→valor do snapshot.
- **Critérios de aceite:** migration aplica sem quebrar os 8 achievements já seedados; 3
  conquistas novas seedadas via `seedAchievements.ts` (mesmo padrão idempotente por nome já
  existente); `isSatisfied`/`progressValueFor` testados table-driven pros 3 critérios novos.
- **Referências:** `proposta-engajamento-licoes.md` §3 (tabela de extensão de catálogo).
- **Dependências:** B.1, B.2 (dado de acerto/erro precisa existir e estar persistido).

### H.2 · Missão diária — revisar lição antiga ✅

- **Descrição:** nova entrada em `MISSION_SEEDS` (`backend/src/db/seedMissions.ts`): "Revise uma
  lição concluída há mais de 14 dias". Diferente das 2 missões de hoje que são
  "reportadas pelo cliente, sem verificação cruzada" (comentário já existente no seed), esta é
  verificável de verdade: `user_lesson_progress.completedAt` mais antigo que 14 dias + reabrir
  essa lição no modo revisão (já suportado pela tela 3.2, ver comentário em `advanceLesson.ts`
  sobre "reabrir lição já concluída"). Nunca penaliza — é convite, some da lista de missões do dia
  se não for feita, sem tirar XP nem estragar streak. **Elegibilidade (confirmado no código,
  não fica em aberto):** `ListDailyMissionsUseCase` hoje mostra o catálogo inteiro pra todo
  usuário, sem nenhum filtro de "consegue completar" — as 3 missões atuais já seguem esse
  precedente (ex: "compare 2 produtos na calculadora" aparece mesmo pra quem não desbloqueou a
  calculadora ainda). Esta missão segue o mesmo padrão: sempre visível, sem checagem prévia de
  "existe lição elegível" antes de mostrar.
- **O que muda na aplicação:** nova linha em `MISSION_SEEDS`; `completeMission.ts`/
  `listDailyMissions.ts` ganham a lógica de verificação cruzada pra este `key` específico (checar
  `user_lesson_progress` por uma lição com `completedAt` antigo reaberta hoje).
- **Critérios de aceite:** usuário que reabre e re-completa uma lição concluída há mais de 14 dias
  tem a missão marcada como concluída automaticamente, sem autorreporte do cliente; usuário sem
  nenhuma lição elegível ainda vê a missão na lista (mesmo padrão das 3 atuais), só não consegue
  completá-la.
- **Referências:** `proposta-engajamento-licoes.md` §3 (Impulso 8); comentário em
  `seedMissions.ts` sobre as 2 missões atuais serem autorreportadas.
- **Dependências:** nenhuma (usa só `completedAt`, já existente — independe de B).
- **Entregável (sessão 2026-09-06):** achado na auditoria de implementação — "reabrir no modo
  revisão" (tela 3.2) hoje pula direto pro passo Desbloqueio sem chamar nenhum endpoint (teste
  existente confirma: `advanceLesson` não é chamado), então não havia nada persistido pra
  verificar cruzado. Resolvido com uma ação de revisão própria, dissociada de
  `AdvanceLessonUseCase`: migration `0011` adiciona `user_lesson_progress.last_reviewed_at`;
  `ReviewLessonUseCase` (`POST /lessons/:id/review`, exige `completedAt` preenchido, nunca credita
  xp/streak) grava esse campo; `HasReviewedOldLessonTodayUseCase` (`domain/lesson.
  isEligibleForReview`, `REVIEW_ELIGIBLE_AFTER_DAYS = 14`) checa `lastReviewedAt` de hoje (UTC) +
  `completedAt` mais antigo que 14 dias — mesmo padrão de porta-por-consumidor de H.1/5.4
  (`LessonReviewChecker` em `modules/missions`, adapter em processo). Frontend chama
  `POST /lessons/:id/review` automaticamente (via `useReviewLesson`, efeito em `Lesson/index.tsx`)
  assim que uma lição já concluída é reaberta — nenhuma ação extra do usuário, "reabrir" já é
  "revisar". `CompleteMissionUseCase` dispatcha a checagem por `mission.key ===
  REVIEW_OLD_LESSON_MISSION_KEY` (não por uma 2ª coluna boolean como `requiresLessonCompletion` —
  só esta missão precisa disso nesta fase). `listDailyMissions.ts` não mudou, conforme a nota de
  elegibilidade já fechada acima (sempre visível, sem checagem prévia).

### H.3 · Missão diária — acertar 3 seguidas

- **Descrição:** nova entrada em `MISSION_SEEDS`: "Acerte 3 apostas seguidas hoje". Verificável via
  `microDecisionSelectedOption`/`microDecisionCorrectOption` (B) nas lições completadas no dia
  corrente — mesma lógica de "sequência de acertos" que `micro_decisions_streak` (H.1) mede pra
  conquista, aqui limitada à janela do dia.
- **O que muda na aplicação:** nova linha em `MISSION_SEEDS`; reaproveita a mesma consulta de
  sequência de acertos que H.1 implementou no snapshot de conquistas, exposta como porta pro
  módulo `missions` (mesmo padrão de porta-por-consumidor já usado entre módulos).
- **Critérios de aceite:** 3 acertos seguidos no mesmo dia completam a missão; um erro no meio
  zera a contagem do dia (não carrega do dia anterior); teste cobrindo sequência quebrada por
  erro.
- **Referências:** `proposta-engajamento-licoes.md` §3/§4.
- **Dependências:** B (dado de acerto/erro), H.1 (lógica de sequência já implementada ali,
  reaproveitada aqui).

---

## Fase I — Teatro de recompensa em tempo real

**Achado novo desta sessão, fora da proposta original** — `identidade-visual-padroes.md` §6 já
documenta o "teatro de recompensa" (energia visual dourada reservada pro momento de recompensa)
como princípio de design, mas não existe nenhum componente que o implemente, nem sistema de
toast/notificação no frontend (`grep` confirmado). **Corrigido nesta revisão:** a versão anterior
tratava XP/nível/conquista/streak como dado "ainda não exposto" — na verdade **já são calculados**
e descartados de propósito no caminho:

- `AwardXpUseCase.execute` já devolve `{ xp, level, leveledUp }` (`gamification/application/useCases/awardXp.ts`).
- `CheckAndUnlockAchievementsUseCase.execute` já devolve `Achievement[]` (as recém-desbloqueadas).
- Mas as portas que os módulos consumidores usam — `XpAwarder.award`, `StreakTracker.touch`,
  `AchievementChecker.checkAndUnlock` (`lessons`/`missions`) — declaram `Promise<void>` e o
  adapter em processo (`inProcessXpAwarder.ts` etc.) joga fora o retorno rico ao chamar
  `await awardXp.execute(...)` sem capturar o resultado.

Por isso a Fase I abre com uma tarefa de encanamento de backend (I.2) antes das tarefas de
frontend — sem ela, I.3-I.5 não têm dado nenhum pra consumir.

### I.1 · Componente compartilhado de celebração ✅

- **Descrição:** organism novo reutilizável (`frontend/src/components/organisms/RewardReveal/`) —
  modal/toast com a energia visual do "teatro de recompensa" (dourado, glow, animação de entrada),
  respeitando `prefers-reduced-motion`. Genérico o bastante pra ser usado por XP, level-up,
  conquista e streak (I.3-I.5), com conteúdo variável (ícone, título, descrição) mas o mesmo
  "invólucro" visual. Fila simples de exibição (um reveal por vez, próximo só depois do atual
  fechar) via um contexto React leve novo em `features/shell/` (não em `store/`, reservado até
  haver caso de uso real de lib de estado global — CLAUDE.md).
- **O que muda na aplicação:** componente novo (`index.tsx`/`index.module.css`/`index.test.tsx`) +
  `features/shell/RewardRevealProvider` (contexto + fila) + hook `useRewardReveal()` exposto pro
  resto do app.
- **Critérios de aceite:** componente renderiza com conteúdo de exemplo nos dois temas
  (claro/escuro); anima só se `prefers-reduced-motion: no-preference`; fecha sozinho depois de N
  segundos ou por ação do usuário; dois reveals disparados em sequência aparecem um de cada vez,
  não sobrepostos.
- **Referências:** `identidade-visual-padroes.md` §6 (teatro de recompensa, já documentado).
- **Dependências:** nenhuma.
- **Entregável:** organism `RewardReveal` (toast, não modal/bottom sheet — §7 reserva esses dois
  padrões pra confirmação de ação importante, e um reveal automático não pode bloquear o fluxo em
  que o usuário já está) + `features/shell/RewardRevealProvider` (fila + `useRewardReveal()`,
  mesmo padrão de pasta/contexto de `AuthContext`: provider e hook exportados do mesmo
  `index.tsx`). Mobile: full-width fixo no topo, abaixo de onde ficaria uma eventual status bar.
  Tablet/desktop (≥768px): canto superior direito, largura fixa — nunca full-width esticado.
  `key={current.id}` em cada `<RewardReveal>` força remontar a cada item novo da fila (reinicia
  animação de entrada e timer de 4s). Achado de bug real nesta sessão (não só teórico do
  StrictMode): o `id` do próximo item da fila **não pode** ser lido de dentro do updater funcional
  de `setQueue` (`current => [...current, { ...content, id: nextIdRef.current }]`) — se `show()`
  é chamado 2x seguidas no mesmo tick (exatamente o caso de uso da tarefa: XP + level-up juntos em
  I.3), os dois updaters só rodam depois que ambos os incrementos do ref já aconteceram, e os dois
  itens nascem com o mesmo id; com o mesmo `key`, o segundo reveal nunca remonta/aparece depois que
  o primeiro fecha (fila implicitamente colapsa pra 1 item visível). Corrigido calculando `id`
  fora do updater, capturado por closure por chamada. Validado via Chrome real (dev server, sem
  precisar de `docker compose` — tarefa 100% frontend): dois reveals em sequência (mock via botão
  de debug temporário na tela de Login, removido depois) aparecem um de cada vez, animação de
  entrada + glow confirmados via `getAnimations()`/computed style (opacity 0→1 em ~150ms, glow
  contínuo), e o trecho `@media (prefers-reduced-motion: reduce)` testado isoladamente (`animation:
  none` força override) mantém o painel visível (opacity 1 por padrão, sem depender da animação pra
  isso). Suíte inteira (591 testes, +8 novos) e lint/tsc/prettier passando.

### I.2 · Backend — portas de gamificação devolvem o resultado real ✅

- **Descrição:** trocar `Promise<void>` por um tipo de resultado real nas 3 portas, nos 2 módulos
  consumidores (`lessons` e `missions`, que hoje duplicam essas portas cada um com sua própria
  cópia — ver `lessons/application/ports/xpAwarder.ts` vs. `missions/application/ports/xpAwarder.ts`):
  - `XpAwarder.award(...)` → `Promise<{ xp: number; level: number; leveledUp: boolean }>`
    (mesmo shape de `AwardXpResult`, já existe em `gamification`).
  - `StreakTracker.touch(...)` → `Promise<{ currentStreak: number; longestStreak: number;
    milestoneReached: number | null }>` — `milestoneReached` é um valor novo, calculado por uma
    função pura nova em `gamification/domain/streak.ts` comparando o streak antes/depois contra os
    **2 marcos que já existem em `seedAchievements.ts`: 7 e 30 dias** (não inventar um marco de 14
    dias — esse número não existe em nenhum achievement seedado, era um erro da versão anterior
    deste documento).
  - `AchievementChecker.checkAndUnlock(...)` → `Promise<Achievement[]>` (o próprio
    `CheckAndUnlockAchievementsUseCase` já devolve isso — só parar de descartar em
    `inProcessAchievementChecker.ts`).
  - `AdvanceLessonUseCase`/`CompleteMissionUseCase` propagam os 3 resultados nos seus próprios
    `Result` (`AdvanceLessonResult`/equivalente em `missions`), e os routers correspondentes
    (`lessonsRouter.ts`/`missionsRouter.ts`) devolvem os campos novos na resposta HTTP — todos
    aditivos, nenhum campo de resposta existente muda de tipo.
- **O que muda na aplicação:** 3 arquivos de porta × 2 módulos (6 arquivos) + os 3 adapters em
  processo correspondentes + `awardXp.ts`/`touchStreak.ts` (sem mudar assinatura, já devolvem o
  necessário) + `advanceLesson.ts`/o caso de uso equivalente em `missions` + os 2 routers +
  `.docs/backend/lessons.md`/`.docs/backend/missions.md` (contrato novo).
- **Critérios de aceite:** `POST /lessons/:id/progress` que completa uma lição devolve
  `xpAwarded`/`leveledUp`/`streakMilestone`/`unlockedAchievements` (nomes exatos a definir na
  tarefa) além do que já devolve hoje; o mesmo pra missões; nenhum teste existente de router
  quebra (campos novos, não substituídos).
- **Referências:** trecho de auditoria no topo desta fase (achado desta sessão).
- **Dependências:** nenhuma (independente de A-H — pode ser feita a qualquer momento).
- **Entregável:** achado de auditoria que corrige o texto original da tarefa — `AchievementChecker`
  **não** é uma port própria de `lessons`/`missions` (o texto acima presumia isso, "achievementChecker
  port... duplicado"); na realidade ela só existe dentro de `gamification` (`AwardXpUseCase`/
  `TouchStreakUseCase` já a chamam internamente depois de creditar xp/tocar streak). `lessons`/
  `missions` nunca a chamam direto — então `unlockedAchievements` chega até elas de carona no
  retorno de `xpAwarder.award`/`streakTracker.touch`, não por uma 3ª port nova. `UnlockedAchievement
  { id, name, description }` duplicado em 3 lugares (port de `gamification`, port de `lessons`, port
  de `missions` — mesma decisão de portas independentes por módulo já usada em
  `profile/application/ports/achievementsReader.ts`, que já duplicava um recorte parecido do mesmo
  tipo real; nenhum import cruzado de módulo). `gamification/domain/streak.ts` ganhou
  `streakMilestoneReached(before, after)` pura (marcos `[7, 30]` fixos, comparados contra
  `seedAchievements.ts` — não 14) — idempotente por construção: `touch()` no mesmo dia devolve
  `before === after`, então nenhum marco é reportado de novo sem precisar de caso especial.
  `AdvanceLessonUseCase`/`CompleteMissionUseCase` concatenam `unlockedAchievements` de `xpAwarder` +
  `streakTracker` sem dedup (seguro: uma conquista já desbloqueada pela 1ª chamada nunca volta a
  aparecer na 2ª, `checkAndUnlockAchievements` já filtra por `unlockedIds`). Campos novos só
  aparecem na resposta quando a chamada de fato credita xp pela 1ª vez — ausentes ao reabrir lição
  já concluída e nas 2 rotas idempotentes de `CompleteMissionUseCase` (já concluída no dia / corrida
  perdida pro `markCompleted` atômico), confirmado via `docker compose up` real (registro de
  usuário, `POST /lessons/:id/progress` completando e reabrindo, `POST /missions/:id/complete`
  completando e reenviando). Testes de use case/router existentes que usavam `toEqual` com o shape
  antigo foram atualizados (adição de campo quebra igualdade exata, não é regressão) — nenhum campo
  removido/retipado. `.docs/backend/lessons.md`/`missions.md` atualizados no mesmo commit. 497
  testes, lint (`no-restricted-imports` sem violação — `UnlockedAchievement` nunca importado entre
  módulos) e `tsc -b` passando.

### I.3 · Conectar XP e level-up ✅

- **Descrição:** com I.2 expondo o dado, disparar `RewardReveal` (I.1) quando a resposta de uma
  mutação (`useAdvanceLesson`, `useCompleteMission`) inclui `xpAwarded`, e um reveal mais forte
  (level-up, não os dois empilhados) quando `leveledUp` vier `true`.
- **O que muda na aplicação:** hooks de mutação que premiam XP passam a chamar
  `useRewardReveal()` no `onSuccess`, lendo os campos que I.2 acrescentou à resposta.
- **Critérios de aceite:** completar uma lição mostra o reveal de XP ganho; um ganho que cruza um
  limiar de nível mostra só o reveal de level-up.
- **Dependências:** I.1, I.2.
- **Entregável:** função pura nova `xpRevealContent` (`frontend/src/features/shell/xpRewardReveal/`)
  decide o conteúdo do reveal a partir de `{ xpAwarded?, leveledUp? }` — `leveledUp` tem prioridade
  e suprime o reveal de XP (`null` quando nem um nem outro está presente, ex: reabrir lição já
  concluída ou reenvio idempotente de missão). Extraída como módulo próprio (não inline nos 2
  hooks) porque a lógica é idêntica nos dois pontos de consumo e duplicá-la arriscaria divergir se
  mudar num só. `useAdvanceLesson`/`useCompleteMissionMutation` chamam `useRewardReveal()` +
  `xpRevealContent(data)` no `onSuccess`, depois de invalidar as queries de sempre — sem mudar
  nenhum comportamento de cache já existente. `services/lessons/types.ts`/`missions/types.ts`
  ganharam os 4 campos novos de `AdvanceLessonResult`/`CompleteMissionResult` (opcionais, espelhando
  o contrato aditivo da I.2 por inteiro — `streakMilestone`/`unlockedAchievements` tipados aqui já
  mesmo sem consumidor ainda, I.4/I.5 os usam). Ícones: `Sparkles` (XP), `TrendingUp` (level-up) —
  nenhum dos dois reaproveitado de `Award`/`Flame`/`GraduationCap` já usados noutros lugares
  (conquista/streak/trilha), evita ambiguidade visual. Achado ao rodar a suíte: `useRewardReveal()`
  chamado incondicionalmente dentro dessas 2 mutations quebrou 4 testes de componente que as
  consomem indiretamente (`Lesson`, `News`, `Calculator`, `FixedIncomeComparisonForm`) — nenhum
  desses testes envolvia `<RewardRevealProvider>` até então; corrigido envolvendo o `render(...)` de
  cada um. Validado com Chrome real (`docker compose up` + dev server, usuário registrado via API +
  onboarding marcado via `PATCH /me` pra pular a tela): completar a 1ª lição (50 XP, nível 1→1)
  mostrou o reveal "+50 XP"; completar a 2ª lição (50+50=100 XP, cruza o limiar do nível 2) mostrou
  só "Você subiu de nível!", sem o reveal de XP empilhado por cima — os dois casos do critério de
  aceite confirmados na prática, não só em teste. 595 testes (+7 novos), lint/tsc/prettier passando.

### I.4 · Conectar unlock de conquista em tempo real ✅

- **Descrição:** disparar `RewardReveal` com nome/descrição de cada item em
  `unlockedAchievements` (I.2), pra qualquer ação que dispare desbloqueio (lição, ordem de
  mercado, streak) — não só visitando `/conquistas` depois.
- **O que muda na aplicação:** hooks de mutação relevantes consomem `unlockedAchievements` da
  resposta (quando presente e não vazio) e disparam 1 reveal por conquista desbloqueada.
- **Critérios de aceite:** desbloquear uma conquista durante qualquer ação mostra o reveal
  imediatamente; nenhuma duplicata se o usuário atualizar a página logo em seguida (idempotência
  do lado do backend já existe — `checkAndUnlockAchievements` não desbloqueia de novo o que já
  está desbloqueado, logo `unlockedAchievements` vem vazio na 2ª chamada).
- **Dependências:** I.1, I.2.
- **Entregável:** achado de auditoria — hoje só `lessons`/`missions` chamam `xpAwarder`/
  `streakTracker` (I.2), então só esses dois pontos produzem `unlockedAchievements`; `modules/market`
  nunca chama `xpAwarder`/`AchievementChecker` (`grep` confirmado), então "ordem de mercado" citada
  na descrição não é um 3º ponto de integração real ainda — quando/se `market` passar a premiar xp
  por operação, ganha o reveal de graça pelo mesmo mecanismo, sem tarefa nova. Função pura nova
  `achievementRevealContents` (`frontend/src/features/shell/achievementRewardReveal/`, mesmo padrão
  de módulo-pasta de `xpRewardReveal`/I.3) mapeia `unlockedAchievements` pra um array de
  `RewardRevealContent[]` (`[]` quando ausente/vazio, sem checagem de dedup — o array já vem vazio
  do backend numa idempotente). Ícone `Award` — mesmo já usado pra conquista em `AchievementsGrid`/
  `PublicProfileCard`, evita a ambiguidade que a I.3 já cuidou de evitar entre `Sparkles`/`TrendingUp`.
  `useAdvanceLesson`/`useCompleteMissionMutation` (os mesmos 2 pontos de consumo da I.3) chamam
  `achievementRevealContents(data).forEach(show)` logo depois do reveal de XP/nível no `onSuccess` —
  cada item entra na fila já existente do `RewardRevealProvider` (I.1), então N conquistas na mesma
  resposta aparecem uma de cada vez, sem código de fila novo. Validado com Chrome real (`docker
  compose up` + dev server, 5 usuários registrados via API só pra este teste): completar a 10ª lição
  de um usuário (limiar da conquista "Estudioso", `lessons_completed = 10`) via clique real na tela
  fez `POST /lessons/:id/progress` devolver `unlockedAchievements: [{ name: "Estudioso", ... }]` e o
  reveal de XP ("+50 XP") aparecer primeiro, auto-fechar aos 4s, e o reveal da conquista ("Estudioso" +
  descrição) aparecer imediatamente em seguida por mais 4s — sequência confirmada por instrumentação
  (`MutationObserver` + patch de `fetch` temporário no console) registrando os timestamps exatos
  (XP montado em t, removido em t+4000ms, conquista montada no mesmo instante, removida em t+8000ms)
  e por captura de tela durante a janela de exibição da conquista. 605 testes (+5 novos em
  `achievementRewardReveal/index.test.tsx`), lint/build/tsc passando.

### I.5 · Conectar marco de streak ✅

- **Descrição:** disparar `RewardReveal` comemorando o marco quando `streakMilestone` (I.2) vier
  preenchido (7 ou 30 — não 14, ver nota de I.2), distinto do reveal de XP genérico.
- **O que muda na aplicação:** mesmo ponto de consumo de I.3, checando o campo `streakMilestone`
  além de `xpAwarded`/`leveledUp`.
- **Critérios de aceite:** bater exatamente 7 ou 30 dias de streak dispara o reveal; dias
  intermediários não disparam nada.
- **Referências:** `seedAchievements.ts` (marcos reais de `streak_days`: 7 e 30).
- **Dependências:** I.1, I.2.
- **Entregável:** função pura nova `streakRevealContent` (`frontend/src/features/shell/
  streakRewardReveal/`, mesmo padrão de módulo-pasta de `xpRewardReveal`/`achievementRewardReveal`)
  — `null` quando `streakMilestone` é `null`/ausente (dia sem marco batido, incluindo qualquer chamada
  idempotente), título `"${milestone} dias seguidos!"` quando é `7` ou `30`. Ícone `Flame` (com
  `fill="currentColor"`, mesmo tratamento visual já usado pra streak em `ProgressionSummary`/
  `PublicProfileCard`/`DailyMissionsList`) — não reaproveita `Sparkles`/`TrendingUp`/`Award`, os 3
  já reservados por XP/level-up/conquista (I.3/I.4). `useAdvanceLesson`/`useCompleteMissionMutation`
  (mesmos 2 pontos de consumo de I.3/I.4) chamam `streakRevealContent(data)` por último, depois do
  reveal de XP/nível e dos de conquista — cada reveal entra na fila já existente do
  `RewardRevealProvider` (I.1), sem fila nova. Validado com Chrome real (`docker compose up` + dev
  server): usuário de teste com `user_progression` ajustado direto no Postgres pra
  `current_streak = 6`/`last_qualifying_activity_date` = ontem (UTC) — um toque de streak away do
  marco de 7 dias, sem precisar simular 7 dias reais de uso. Completar 1 lição via clique real
  disparou `POST /lessons/:id/progress` com `streakMilestone: 7` **e** `unlockedAchievements:
  [{ name: "Primeira Semana", ... }]` na mesma resposta (o marco de streak também satisfaz um
  achievement de `streak_days`, achado que confirma a I.4/I.5 não brigam — os 2 reveals convivem na
  mesma fila). Sequência confirmada via a mesma instrumentação da I.4 (`MutationObserver` + patch
  temporário de `window.fetch`, sem alterar código-fonte): XP montado em t, some em t+4000ms,
  conquista "Primeira Semana" monta no mesmo instante, some em t+9000ms, reveal de streak
  ("7 dias seguidos!") monta no mesmo instante, some em t+13000ms — os 3 reveals da mesma resposta
  em fila, cada um por 4s, sem sobreposição nem perda. 604 testes (+4 novos em
  `streakRewardReveal/index.test.tsx`), lint/build/tsc passando.

---

## Fase J — Bloqueio como convite, não parede

**Origem: pergunta do autor** — a trava real de feature/produto por lição (tarefa 7.0.1, já em
produção) faz sentido e corrige um bug de verdade (usuário conseguia comprar ativo real sem
completar a lição correspondente). O risco levantado é outro: como está *apresentada* hoje pode
desmotivar em vez de guiar. Auditoria desta sessão contra o código real achou 3 tratamentos
inconsistentes, do melhor pro pior:

| Onde | O que mostra hoje | Caminho de volta pra trilha? |
|---|---|---|
| Feed de notícias | Aviso não-bloqueante, conteúdo continua acessível | Não se aplica |
| `EquityList`/`FixedIncomeList` (linha de ativo) | Ticker/nome/preço **já aparecem normais** (não estão escondidos, confirmado no código) + ícone de cadeado pequeno; motivo só existe em `title`/`aria-label` (invisível em touch) | Sim — clique já redireciona pra lição via `useLockedAssetGate.selectOrRedirectToLesson` |
| `TabBar` (Portfólio/Calculadora, toda tela) | Ícone de cadeado + label apagado, `aria-disabled="true"` | **Nenhum** — sem `onClick`, sem navegação, sem texto visível |

O pior caso (`TabBar`) é também o de maior exposição — navegação primária, visível em toda tela.

### J.1 · `TabBar` deixa de ser beco sem saída ✅

- **Entregável:** `span aria-disabled` trocado por `button` clicável em `TabBar/index.tsx`,
  navegando via `findLessonUnlocking(unlockKey, lessons)` pra `/trilha/${hint.id}` (ou `/trilha`
  sem lição correspondente) — mesmo padrão de `useLockedAssetGate.selectOrRedirectToLesson`, zero
  lógica nova extraída. `aria-label` novo por aba travada ("X travado, desbloqueia na lição Y" /
  "X travado pela trilha") substitui o `aria-disabled` antigo; label visual (`<span
  aria-hidden>`) permanece só decorativo, leitor de tela usa o `aria-label` do botão. CSS
  `.locked` virou `cursor: pointer` (era `not-allowed`) mantendo cor apagada — distinta de link
  ativo/hover, conforme critério de aceite. Testes cobrindo clique com/sem lição encontrada;
  suite completa (511 testes) e `docker compose up` de ponta a ponta verificados nos 3
  breakpoints (mobile bottom bar, tablet/desktop barra horizontal).
- **Descrição:** trocar o `<span aria-disabled="true">` da aba travada
  (`frontend/src/components/organisms/TabBar/index.tsx`) por um elemento clicável que navega pra
  lição que desbloqueia aquele `unlockKey`, reaproveitando `findLessonUnlocking`
  (`features/lessons/unlockedKeys`) — **já genérica** (aceita qualquer chave, não só `asset:*`;
  confirmado nesta sessão), então nenhuma extração de lógica nova é necessária, só usar a função
  que já existe. Mesmo comportamento que `useLockedAssetGate.selectOrRedirectToLesson` já dá pras
  linhas de ativo travadas.
- **O que muda na aplicação:** `TabBar/index.tsx` — troca o `span` por `button`/elemento
  clicável com `onClick` chamando `navigate(hint ? \`/trilha/${hint.id}\` : '/trilha')`;
  `useUnlockedKeys()` já devolve `lessons`, só passa a ser desestruturado também aqui (hoje só usa
  `unlockedKeys`/`isLoading`/`isError`).
- **Critérios de aceite:** tocar/clicar numa aba travada navega pra lição que a desbloqueia; aba
  continua visualmente distinta de uma aba disponível (ícone de cadeado, cor apagada — não vira
  link idêntico a uma aba normal); leitor de tela anuncia o destino (`aria-label` novo, já que
  deixa de usar `aria-disabled`).
- **Referências:** análise da sessão anterior (chat, "trava sem caminho de volta");
  `useLockedAssetGate` como precedente já funcionando.
- **Dependências:** nenhuma.

### J.2 · Motivo do bloqueio fica visível, não só em tooltip ✅

- **Entregável:** `LockedAssetBadge` ganhou `visibleText` (`Lição {code}` ou `Travado` como
  fallback genérico) como filho visível ao lado do ícone de cadeado — `title`/`aria-label`
  mantêm a frase completa pra hover/leitor de tela, sem duplicar (o texto curto é
  `aria-hidden`). `TabBar` ganhou `.lockHint` (`Lição {code}`, só quando `findLessonUnlocking`
  encontra a lição) como `<span aria-hidden>` extra no botão travado — visível por padrão
  (tablet/desktop) e `display: none` dentro da media query `max-width: 767px` já existente da
  barra inferior fixa, decisão 100% CSS, zero lógica JS por breakpoint. Testes cobrindo texto
  visível em ambos os componentes (com/sem lição encontrada); suite completa (515 testes),
  lint e build passando. Verificado via `docker compose up` nos 3 breakpoints: mobile (390px,
  cards + bottom bar só ícone/label), tablet (900px, ainda em cards por causa do breakpoint de
  1024px do `AssetTable`, mas `TabBar` já horizontal com legenda) e desktop (1440px, tabela +
  badge/legenda visíveis, sem quebra de coluna).
- **Descrição:** `LockedAssetBadge` (`frontend/src/components/molecules/LockedAssetBadge/index.tsx`)
  hoje só grava "Desbloqueia na lição X" em `title`/`aria-label` — invisível em touch (sem hover) e
  de baixo contraste até em desktop (precisa passar o mouse). Tornar esse texto visível na própria
  célula, não só acessível via tooltip. Mesma ideia pra `TabBar`: legenda pequena com o código da
  lição, só em tablet/desktop (barra horizontal, mais espaço) — mobile (barra inferior fixa,
  `identidade-visual-padroes.md` §7) mantém só ícone+label, confiando no toque de J.1 como
  caminho, pra não quebrar o layout compacto.
- **O que muda na aplicação:** `LockedAssetBadge` ganha o texto como conteúdo visível (não só
  atributo); `TabBar` ganha a legenda condicionada por breakpoint via CSS (`index.module.css`),
  não lógica JS nova. Testar nos 3 breakpoints obrigatórios (regra do `CLAUDE.md` pra toda tela
  alterada).
- **Critérios de aceite:** motivo do bloqueio legível sem depender de hover/toque prolongado, nos
  3 breakpoints; nenhuma quebra de layout das colunas de `EquityList`/`FixedIncomeList`; teste de
  componente cobrindo o texto visível.
- **Referências:** `identidade-visual-padroes.md` §7 (breakpoints).
- **Dependências:** J.1 (mesma área de código da `TabBar`, já alterada ali).

### J.3 · Detalhe do Ativo travado vira prévia, não parede ✅

- **Entregável:** `useLockedAssetGate.selectOrRedirectToLesson` virou `selectAsset(detailPath)` —
  navega sempre pro Detalhe, travado ou não (comportamento compartilhado por `EquityList` e
  `FixedIncomeList`, já que os dois consomem o mesmo gate); ganhou `unlockingLessonFor(asset)`
  (extraído do que já existia dentro de `lockedBadge`) pra expor a lição completa (`id`/`code`)
  pra quem monta UI, não só o `code` do badge. `AssetDetail/index.tsx` troca o painel de compra
  (`EquityOrderTicket`) por `LockedAssetPanel` (molécula nova, compartilhada) quando
  `gate.isLocked(asset)` — ticker/preço/gráfico/indicadores continuam normais, só o painel de
  ordem muda. `services/client` passou a jogar o corpo bruto do erro inteiro em
  `ApiError.details` (não só `errorBody.details`) — é o que permite `ProductLockedError`
  (`{ error, key, unlockingLesson }`, foge da convenção `{ error }`) ser lido em algum lugar do
  frontend pela primeira vez, via `features/market/productLockedError.asProductLockedError`
  (função pura testada). `OrderConfirmationDialog` usa essa função no catch do `handleConfirm` e
  mostra o mesmo `LockedAssetPanel` (sem `lessonId`, já que o 403 só traz `code`/`title` — CTA
  cai no Mapa da Trilha genérico) em vez da mensagem de erro genérica. `FixedIncomeDetail` fica
  fora do escopo da troca de painel (só `AssetDetail`/4.5, por decisão explícita do backlog) —
  seu fluxo de aporte já fica coberto pelo tratamento genérico do `OrderConfirmationDialog`
  acima. Testes cobrindo `selectAsset`/`unlockingLessonFor`, `asProductLockedError` (5 casos),
  `LockedAssetPanel` (CTA com/sem `lessonId`), `AssetDetail` travado/sandbox e o novo caso de
  `OrderConfirmationDialog`; suite completa (529 testes), lint e build passando. Verificado via
  `docker compose up`: clique num ativo travado abre o Detalhe (não mais a lição) mostrando
  indicadores normais + banner "Travado pela trilha — Desbloqueia na lição X" no lugar do painel
  de compra, CTA navega pra `/trilha/:id`; fluxo de renda fixa (fora do escopo do banner
  proativo) mostra o mesmo banner amigável dentro do `OrderConfirmationDialog` quando o 403
  chega na confirmação.
- **Descrição:** hoje `useLockedAssetGate.selectOrRedirectToLesson` sempre redireciona pra lição
  ao clicar num ativo travado — o usuário nunca chega a ver a tela de Detalhe (indicadores,
  gráfico, dados — tudo somente leitura, a trava real é só no `POST` de ordem/compra, RF12/7.0.1).
  Mudar pra navegar sempre pro **Detalhe de verdade**, que passa a mostrar um banner fixo "Travado
  — desbloqueia na lição X" com CTA "Ir pra lição" no lugar do painel de compra, em vez de deixar
  tentar comprar e só descobrir o bloqueio no 403. Tratar a resposta `ProductLockedError`
  (`{ error, key, unlockingLesson }`, já existe no backend desde a 7.0.1) de forma amigável —
  hoje nenhum lugar do frontend lê esses 3 campos (`grep` confirmado), útil também pro caso de o
  usuário chegar na tela por outro caminho (link direto, botão voltar).
- **O que muda na aplicação:** `useLockedAssetGate.selectOrRedirectToLesson` reescrita pra navegar
  pro Detalhe (não pra lição) quando travado; `AssetDetail/index.tsx` ganha awareness de lock
  (reaproveita `useLockedAssetGate.isLocked`) e troca o painel de compra pelo banner+CTA quando
  travado; tratamento de erro do formulário de ordem ganha um `case` pra `ProductLockedError`
  mostrando o mesmo banner em vez de mensagem genérica.
- **Critérios de aceite:** clicar num ativo travado abre o Detalhe (não redireciona mais direto
  pra lição); Detalhe travado mostra ticker/preço/indicadores normalmente + banner com CTA no
  lugar do painel de compra; acessar via URL direta e tentar comprar mostra o mesmo banner
  amigável em vez do erro genérico atual.
- **Referências:** `.docs/backend/market.md` (shape de `ProductLockedError`); RF12 (sandbox
  isento, não mexer).
- **Dependências:** nenhuma (mesma área temática de J.1/J.2, mas código independente).

### J.4 · Indicador de "faltam N lições pra X" ✅ concluída

- **Descrição:** nenhum lugar do app hoje mostra quanto falta pra desbloquear a próxima coisa —
  só o Mapa da Trilha (que já é a fonte da verdade, mas exige entrar lá pra ver). Acrescentar um
  indicador pequeno no `ProgressionSummary` (organism já renderizado em `Portfolio`/`Track`, hoje
  só mostra Nível/XP e streak): "faltam N lições pra: [nome do próximo desbloqueio]".
- **O que muda na aplicação:** função pura nova (`nextUnlockFor(lessons)`, em
  `features/lessons/`, testada) devolvendo `{ description: string; lessonsRemaining: number } |
  null` — acha a próxima lição não concluída cujo `unlocksKeys`/`unlocksDescription` não é vazio;
  `ProgressionSummaryProps` ganha campo opcional `nextUnlock`; `Portfolio`/`Track` calculam e
  passam esse dado (checar em cada página, na própria tarefa, se `useLessonsQuery`/
  `useUnlockedKeys` já estão disponíveis ali ou precisam ser adicionados).
- **Critérios de aceite:** usuário com pelo menos 1 chave ainda travada vê "faltam N lições pra
  [X]"; usuário com tudo desbloqueado não vê o badge (sem estado vazio estranho no lugar); número
  bate com a distância real mostrada no Mapa da Trilha.
- **Entregável:** `features/lessons/nextUnlockFor` (função pura + `types.ts` com `NextUnlock` +
  teste table-driven cobrindo lista vazia, alvo é a própria lição `available`, alvo mais à frente,
  lições sem desbloqueio no meio do caminho, e o caso "tudo concluído" → `null`). Checa só
  `unlocksDescription` truthy (não `unlocksKeys` separado): auditoria de `seedLessons.ts` confirma
  que as duas sempre andam juntas nas 33 lições atuais (toda vez que `unlocksKeys` tem chave,
  `unlocksDescription` também está preenchido), então isso já cobre o critério original sem lógica
  extra. `lessonsRemaining` = `sortOrder` da lição-alvo menos a contagem de `completed` (a trilha é
  estritamente sequencial no backend, `lessonStatus`, então a distância é aritmética simples, sem
  precisar reimplementar a regra de bloqueio no cliente). `ProgressionSummaryProps` ganhou
  `nextUnlock?: NextUnlock | null`; `ProgressionSummary` envolveu os badges existentes num novo
  `.container` (coluna) e acrescentou `<p className={styles.nextUnlock}>` só quando `nextUnlock`
  existe, com `<strong>` na description. `Portfolio` e `Track` (ambos já tinham `useLessonsQuery`
  carregado) calculam `nextUnlockFor` e passam pro `ProgressionSummary`; em `Portfolio`, fica
  `null` enquanto `lessonsQuery` não resolveu, sem bloquear os badges de XP/streak (que dependem só
  de `progressionQuery`/`streakQuery`). Testes novos em `ProgressionSummary`, `Portfolio` e `Track`
  cobrindo aparição/ausência do indicador e o singular "1 lição" vs. plural. Validado com o app
  real via `docker compose up --build` + `db:seed:lessons` + usuário novo registrado por `curl` +
  lição 0.1 avançada até `completed` via `POST /lessons/:id/progress`: confirmado no Chrome que
  `/trilha` e `/` mostram "Faltam 1 lição pra: Calculadora Financeira" (bate com a "PRÓXIMA LIÇÃO"
  do Mapa da Trilha).
- **Referências:** análise da sessão anterior (chat).
- **Dependências:** nenhuma tecnicamente (lê `sortOrder`/`status`/`unlocksKeys`/
  `unlocksDescription` ao vivo — nenhum desses 4 campos é tocado por A/B/C/D, que só mudam
  `scenarioText`/`microDecisionPrompt`/`revelationText`, e opções novas em B). **Só um motivo de
  ordem, não de correção:** `unlocksDescription` é justamente o campo que a E.1 reescreve com o
  "porquê" narrativo — fazer J.4 antes da E.1 não quebra nada (o texto mostrado só melhora sozinho
  quando E.1 rodar, sem tocar em J.4 de novo), mas fazer depois evita mostrar a versão "funcional"
  do texto por um tempo até E.1 chegar. Sequência sugerida abaixo já reflete isso.

---

## Sequência de implementação sugerida

Ordem única, pensada pra sessão solo (uma tarefa por sessão, sem paralelismo real) — não é a ordem
alfabética das fases. Critério: dependências reais primeiro, valor visível cedo, tarefas de maior
risco de schema (B, depois H/G) só depois de validar as de baixo risco, e duas fases descobertas
em auditoria (I — teatro de recompensa, J — bloqueio como convite) priorizadas mesmo fora da ordem
alfabética porque são independentes de tudo o mais e de risco baixíssimo.

**J.1-J.3 entram primeiro de todas.** Diferente de A-I (melhorias sobre algo que já funciona),
elas mexem numa interação hoje genuinamente quebrada (aba da `TabBar` sem nenhum caminho de
volta) — mais perto de corrigir um bug de UX do que de adicionar um recurso novo, e é a área de
maior exposição do app (navegação primária, toda tela). Zero schema, zero dependência de qualquer
outra fase. **J.4 é a exceção dentro da própria Fase J** — tecnicamente também independente (lê
`unlocksDescription` ao vivo, nenhuma fase muda esse campo além da E.1), mas só entrega a melhor
versão do texto depois que a E.1 já reescreveu o "porquê" de cada trilha, então entra logo depois
dela, não junto das outras 3.

1. **J.1** — `TabBar` deixa de ser beco sem saída
2. **J.2** — motivo do bloqueio fica visível (não só tooltip)
3. **J.3** — Detalhe do Ativo travado vira prévia, não parede
4. **A.1** — parser de cartões (fundação de A/C, zero risco)
5. **E.1** — arco narrativo (conteúdo puro, independente, vitrine rápida)
6. **J.4** — indicador de "faltam N lições pra X" (depois da E.1 de propósito — mesmo campo,
   `unlocksDescription`, que ela acabou de melhorar; ver nota na própria tarefa)
7. **A.2** — reescrita das 33 lições em cartões
8. **A.3** — revelação progressiva
9. **C.1** — glossário inline
10. **C.2** — elenco recorrente
11. **H.2** — missão de revisão (independente de B, baixo risco — adiantar em vez de deixar pro
    fim da Fase H)
12. **F.1** — tokens de cor por trilha
13. **F.2** — backend: trilhas concluídas no perfil público
14. **F.3** — `TrackTrophyCase`
15. **G.1** — backend: evento de trilha concluída
16. **G.2** — seção de atividade recente em `/amigos`
17. **I.1** — componente de celebração
18. **I.2** — portas de gamificação devolvem resultado real
19. **I.3** — conectar XP/level-up
20. **I.4** — conectar conquista
21. **I.5** — conectar marco de streak
22. **B.1** — schema de opções/resposta correta
23. **B.2** — backend grava a escolha
24. **B.3** — widget de escolha real
25. **B.4** — auditoria e autoria das opções
26. **H.1** — extensão do enum de conquistas (depende de B.1/B.2)
27. **H.3** — missão de 3 seguidas (depende de B, H.1)
28. **D.0** — checkpoint de decisão (só depois de A-C **em produção** por um tempo, não
    imediatamente após a sessão de código anterior)
29. **D.1** — blocos tipados (só se D.0 = seguir)
30. **D.2** — XP variável por desempenho (só se D.0 = seguir; depende de B)

Passos 1-21 não tocam nenhuma coluna de dado financeiro nem enum existente — é a fatia de menor
risco e maior volume de valor, por isso vem toda antes de B. Passos 22-27 são a fatia de "aposta
real", que abre schema novo (pequeno, nullable) e alimenta H. D fica por último de propósito: é o
único bloco que só faz sentido com uso real do resto já rodando.

## Resumo de contagem

| Fase | Tema | Nº de tarefas | Toca schema? |
|---|---|---|---|
| A | Fatiar conteúdo existente | 3 | Não |
| B | Aposta com acerto/erro real | 4 | Sim (colunas nullable) |
| C | Glossário e elenco recorrente | 2 | Não |
| D | Checkpoint + blocos tipados + XP fracionado | 3 | Sim (D.1, condicional) |
| E | Arco narrativo por trilha | 1 | Não |
| F | Sala de troféus no Perfil | 3 | Sim (F.2, campo novo em endpoint existente) |
| G | Feed social de aprendizado | 2 | Sim (tabela nova) |
| H | Revisão e conquistas por qualidade | 3 | Sim (enum) |
| I | Teatro de recompensa em tempo real | 5 | Não (contratos de resposta, sem migration) |
| J | Bloqueio como convite, não parede | 4 | Não |
| **Total** | | **30** | |
