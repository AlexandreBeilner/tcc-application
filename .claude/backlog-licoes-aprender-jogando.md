# Backlog: lições que ensinam jogando (LJ)

> **Backlog executável** (criado em 2026-10-17), derivado de `proposta-licoes-aprender-jogando.md`
> (o "porquê", com os números da varredura e as fontes). O autor aprovou os **Lotes 1, 2 e 3** e
> depois pediu que tudo o mais que melhore a experiência entre agora: daí o **Lote 5**, que traz
> do Lote 4 o que não depende do personagem ("Relembra?", encurtar lições longas, gancho de
> abertura) e acrescenta o que faltava (tempo estimado, gestos, som e vibração, revisão espaçada
> das perguntas erradas, coleção de termos, compartilhar resultado, funil por cartão). **Só o
> personagem da Trilha 0 (proposta 4.1) fica fora**, à espera do teste do autor num gerador
> externo.
>
> Mesma disciplina dos outros backlogs: uma tarefa por sessão, critério de aceite verificado antes
> do ✅, Entregável registrado na própria tarefa, checklist do `CLAUDE.md` para toda tarefa que
> toca `backend/`, rota nova documentada em `.docs/backend/lessons.md` no mesmo commit, toda tela
> responsiva nos três breakpoints e conteúdo dentro de `diretrizes-redacao-licoes.md`.
>
> **Limites que nenhuma tarefa daqui atravessa:** nunca cronômetro, nunca perda de XP ou nível,
> nunca "última chance" (`proposta-engajamento-licoes.md` §3). A D.2 (XP variável por desempenho,
> `backlog-engajamento-gamificacao.md`) continua em aberto: aqui o XP da lição segue fixo
> (`LESSON_XP_REWARD`), e o placar e as sequências são só reconhecimento visual.

## Estado do código hoje (ponto de partida, conferido em 2026-10-17)

| Peça | Onde | O que importa para este backlog |
|---|---|---|
| Player | `frontend/src/pages/Lesson/index.tsx` | 4 fases (`TOTAL_STEPS`), barra de 4 segmentos no topo e `LessonCardDots` por fase; tela final (`step === 3`) mostra só "Lição concluída" e o `unlocksDescription` |
| Cartões | `frontend/src/features/lessons/playerCards/index.ts` | `buildPhaseCards`: cada bloco de widget ou check vira um cartão próprio; o texto se fatia por `\n\n` |
| Checkpoint | `backend/src/modules/lessons/domain/widgets/lessonBlocks.ts` | `CheckBlock` só tem `single` e `true_false`; `CheckResponse = { selectedOption?: number }`; `isCheckCorrect` compara índice |
| Estado do checkpoint | tabela `user_lesson_checkpoints` | `attempts`, `wrong_options smallint[]`, `solved_at`; feita para resposta por índice |
| Placar | `GET /lessons/:id` | já devolve `checkpoints[]` (`firstTry`) e `checkpointsFirstTry` |
| XP da conclusão | `AdvanceLessonUseCase` | devolve `xpAwarded`, `leveledUp`, `newLevel` e as conquistas desbloqueadas |
| Validação de conteúdo | `backend/src/content/contentRules.ts` | `blockTextFields` só varre props que são string: listas de itens (novos formatos) escapam da varredura de texto proibido |
| Edição de conteúdo | painel `/admin/conteudo` | edita os campos de texto legados, **não** os `blocks`; mudança de bloco hoje é seed + script de aplicação no banco |
| Seed | `seedLessons.ts` | só importa lição que falta, nunca sobrescreve (N.23); conteúdo novo em lição existente exige script aditivo, no molde de `convertNumericChecks.ts` |

## Decisões do autor

Estas escolhas mudam o comportamento e não estavam em nenhum documento. **Todas fechadas pelo
autor em 2026-10-17**: as cinco primeiras seguiram a recomendação; a LJ-D6 não.

| # | Pergunta | Decisão |
|---|---|---|
| LJ-D1 ✅ | A **estimativa** (2.2) segue a regra "errar não avança"? | **Não.** A estimativa é previsão, não prova: a pessoa chuta, sempre avança e vê a distância do valor real. A graça está na surpresa, e travar até acertar mata a surpresa (a pessoa ia chutar até cair na faixa). Conta no placar como "na mosca" quando cai na tolerância. |
| LJ-D2 ✅ | Nos formatos com várias peças (ordenar, agrupar, ligar), errar mostra **quanto** acertou? | **Sim, só a contagem** ("3 de 5 no lugar certo"), sem dizer quais. Com várias peças, "errado" sem nenhuma pista vira tentativa às cegas; a contagem mantém o desafio sem entregar o gabarito (respeita o espírito da D3 da revisão). |
| LJ-D3 ✅ | Em **ligar pares**, o par errado é recusado na hora? | **Sim**, par a par (o par errado treme e se desfaz), como no Duolingo. É o único formato em que a checagem por peça é natural; o placar conta "de primeira" só se nenhum par falhou. |
| LJ-D4 ✅ | A **missão de widget** (Lote 3) trava o Continuar? | **Sim, como checkpoint**, com uma saída: depois de 2 minutos mexendo sem atingir (sem cronômetro visível) ou 6 interações, aparece "Me mostra" que leva os controles ao valor-alvo e explica. Ninguém fica preso, e quem tenta sozinho tem a vitória. |
| LJ-D5 ✅ | A **enquete** mostra o resultado com quantos votos? | **Só com 20 votos ou mais** na opção agregada; antes disso, "Você está entre os primeiros a responder". Nunca nome, nunca lista de quem votou (RNF09 continua intacta: é opinião, não patrimônio). |
| LJ-D6 ✅ | Na **coleção de termos** (LJ.5.9), o que o perfil público mostra? | **Contagem e as cartas ganhas** (o autor escolheu mostrar mais que a recomendação, que era só a contagem). Termo aprendido não é dado financeiro, então a RNF09 não se aplica; as cartas que faltam continuam aparecendo só no próprio perfil. |

---

## Lote 1: ritmo do player

Só frontend (exceto a LJ.1.5, conteúdo). Vale para as 43 lições de uma vez e é reversível.
Ordem: 1.1 e 1.2 primeiro (mexem no mesmo cabeçalho), depois 1.3, 1.4 e 1.6, por fim 1.5.

### LJ.1.1 · Barra de progresso contínua ✅ concluída

**O que fazer:** trocar os 4 segmentos do topo e os `LessonCardDots` de cada fase por **uma barra
única** que avança a cada cartão da lição inteira (Cenário + Micro-decisão + Revelação + tela
final). A posição é derivada de `step` e `subStep` sobre a soma dos cartões das três fases
(`buildPhaseCards` já dá as listas).

**Criatividade:** a barra tem marcos nos cartões de pergunta (pontinho no trilho) que acendem em
âmbar (`--color-gamify-500`) quando acertados de primeira e em neutro quando acertados depois.
Olhando a barra, a pessoa vê o próprio desempenho e quanto falta, num só elemento.

**Critérios de aceite:**
- Avançar, voltar e revisar mantêm a barra coerente; lição legada sem `blocks` também funciona.
- Leitor de tela anuncia "Cartão 7 de 15" (`role="progressbar"` com `aria-valuenow`/`max`).
- `prefers-reduced-motion` desliga a animação do preenchimento.
- Os três breakpoints conferidos; no mobile a barra não empurra o conteúdo.
- Testes: função pura de posição (fases vazias, fase com 1 cartão, revisão) e render da barra.

- **Entregável:** (2026-10-18) Barra única no cabeçalho, na mesma linha do "Sair da lição" (no mobile não empurra o conteúdo). Função pura `lessonProgress` e `progressMarkers` em `features/lessons/lessonProgress`; molécula `LessonProgressBar` (`role="progressbar"`, "Cartão X de Y", marcos vazados/âmbar/neutro, `prefers-reduced-motion` sem transição). A tela final conta como último cartão. `LessonCardDots` saiu do player (a prévia do admin ainda usa). Só a pergunta do bloco `check` ganha marco; a aposta legada da Micro-decisão não. Corrigido de passagem um erro de tipo que vinha da LJ.5.1 (`LessonCardFunnel` não importado em `services/admin`).


### LJ.1.2 · Rótulos humanos nas fases ✅ concluída

**O que fazer:** sair do vocabulário de apostila. Hoje: eyebrow "Cenário", "Micro-decisão",
"Revelação" e títulos fixos "Pense antes de continuar" e "Por que isso importa". Proposta:
- Título de todas as fases passa a ser o **título da lição** (dá identidade, não muda a cada fase).
- A fase vira uma etiqueta curta: Cenário sem etiqueta; Micro-decisão vira **"Sua aposta"**;
  Revelação vira **"O que acontece"**; tela final, **"Lição concluída"**.
- A tela final troca "Desbloqueio" por um título com o resultado (ver LJ.1.4).

Manter o `LessonPreview` do painel admin com os mesmos rótulos (é a prévia do que a pessoa vê).

**Critérios de aceite:** nenhum rótulo antigo sobra no player nem na prévia; testes de página
atualizados; nada de travessão.

- **Entregável:** (2026-10-18) Título da lição em todas as fases; etiquetas "Sua aposta", "O que acontece" e "Lição concluída" (Cenário sem etiqueta). A tela final mantém só a etiqueta e o título da lição; o título com o resultado vem na LJ.1.4. `LessonPreview` com os mesmos rótulos nas abas (a aba do Cenário continua "Cenário", é só navegação do painel). O rótulo de campo "Revelação" do editor de lição não mudou.


### LJ.1.3 · "Na plataforma" vira rodapé recolhido ✅ concluída

**O que fazer:** em `buildPhaseCards`, quando um bloco `platform-note` vem depois de outro bloco
da mesma fase, ele **não vira cartão próprio**: é anexado ao cartão anterior como `footnote`. O
cartão renderiza o rodapé como `<details>` fechado, com o selo "Na plataforma" e as três linhas
ao abrir. Se o `platform-note` for o primeiro bloco da fase, continua cartão próprio.

**Efeito:** 34 cartões a menos no currículo, e a lição deixa de terminar num aviso.

**Critérios de aceite:**
- As três linhas continuam acessíveis (teclado, leitor de tela) e o resumo textual do widget segue
  existindo.
- O `<details>` lembra se foi aberto só durante a lição (estado local).
- A regra de conteúdo (`PLATFORM_NOTE_EXEMPT_RULE_IDS`) segue valendo, sem mudança no backend.
- Teste do `buildPhaseCards` cobrindo: nota no meio, nota como primeiro bloco, duas notas seguidas.

- **Entregável:** (2026-10-18) `buildPhaseCards` anexa o `platform-note` ao cartão anterior (`footnotes[]`, aceita duas notas seguidas; como primeiro bloco da fase continua cartão). Novo organismo `PlatformNoteFootnote` (`<details>` fechado, resumo textual no `aria-label`, props inválidas caem no fallback do widget); aberto/fechado fica no estado da lição (sobrevive a Voltar). Cartão `[revelar]` ainda fechado não mostra a nota. `PlatformNote` ganhou `PlatformNoteRows`, reaproveitado. Sem mudança de backend. Os índices de cartão mudaram: o funil antigo da LJ.5.1 deixa de corresponder nas lições com nota (usar janela curta).


### LJ.1.4 · Tela final com placar e próximo passo ✅ concluída

**O que fazer:** a tela final (`step === 3`) passa a mostrar, nesta ordem:
1. **Resultado em uma linha**, com título variando pelo desempenho: todas de primeira, "Na
   mosca!"; a maioria, "Mandou bem!"; o resto, "Lição concluída". Nunca um título negativo.
2. **Placar:** "4 de 5 de primeira", desenhado como a fileira de marcos da barra (LJ.1.1).
   Fonte: `checkpointsFirstTry` e `checkpoints[]` do `GET /lessons/:id`, sem rota nova.
3. **XP ganho** (`xpAwarded`) com a contagem animada até o valor, reaproveitando o
   `RewardReveal` (sem duplicar a celebração que o provider já dispara: coordenar com o
   `xpRewardReveal`).
4. **"O que ficou"**: os 2 ou 3 resumos da lição (LJ.1.5); sem resumo, o bloco não aparece.
5. **Próximo passo**: o CTA de desbloqueio que já existe ("Comprar agora", `featureUnlockCta`) e,
   abaixo, um **teaser da próxima lição** (título + o primeiro cartão cortado em uma linha), para
   o Continuar ter um motivo.

Em revisão (lição já concluída), mostra o placar gravado e omite o XP.

**Critérios de aceite:** os três breakpoints (desktop com placar e resumo lado a lado, não coluna
esticada); nenhum valor absoluto de patrimônio; testes do título por desempenho e da revisão.

- **Entregável:** (2026-10-18) Tela final nova, organismo `LessonFinish` (+ molécula `LessonScoreboard`): etiqueta com o nome da lição, `h1` com o resultado (`scoreTitle`: todas de primeira "Na mosca!", mais da metade "Mandou bem!", o resto ou sem pergunta "Lição concluída", nunca negativo), placar "N de M de primeira" desenhado como a fileira de marcos da barra, XP em contagem animada (`useCountUp`, valor final de uma vez com `prefers-reduced-motion`), "O que ficou" (some sem `summary`), o texto do que a lição libera, teaser da próxima lição (`nextLessonTeaser`: título e começo do primeiro cartão de texto em uma linha; some se a próxima estiver bloqueada) e os mesmos CTAs de antes (`data-lesson-continue`/`data-lesson-back` preservados). **Coordenação com o `xpRewardReveal`:** `useAdvanceLesson(lessonId, { inlineXp: true })` tira o `xpAwarded` do aviso global na conclusão, porque a contagem da tela já é a celebração; subir de nível ainda dispara o aviso de nível (informação diferente), e conquistas e marco de streak seguem pelo aviso global. Em revisão: placar gravado no servidor (`lesson.checkpoints`) e sem XP; se não houver nenhuma resposta gravada (lição concluída antes de existirem as perguntas), o placar some em vez de mostrar "0 de N de primeira". Desktop >= 1024px: resultado e "O que ficou" lado a lado, próximo passo na largura toda (sem resumo, o resultado ocupa a largura). Funções puras `lessonScore`/`scoreTitle`/`scoreSummary` com teste; `LessonPreview` do admin alinhado (nome da lição em cima, "Lição concluída" como título neutro; o título real depende das respostas, que a prévia não tem). Estilos `.unlock*` antigos saíram de `pages/Lesson`. **Conferência visual (2026-10-18):** desktop 1567 px, mobile 390 e tablet 820 (os dois últimos por iframes na mesma aba, porque `resize_window` não muda o viewport e a captura continua em 1567) e o fluxo real de conclusão com usuário descartável (removido): contagem até "+50 XP", placar, resumo, teaser, "Faltam ~2 min" ao retomar, sem aviso global duplicado. Não vi na tela o ponto âmbar de "de primeira" nem os títulos "Na mosca!"/"Mandou bem!" (só pelos testes).

### LJ.1.5 · Conteúdo: "O que ficou" das 43 lições ✅ concluída

**O que fazer:** campo opcional `summary: string[]` (de 2 a 3 itens, até 120 caracteres cada) na
raiz de `LessonBlocks` (`schemaVersion` continua 1, o campo é opcional). Validação Zod nos dois
lados; `contentRules.blockTextFields` passa a varrer o `summary`. Escrever os resumos das 43
lições no seed e aplicar no banco com um script aditivo (só preenche onde não há `summary`, no
molde de `convertNumericChecks.ts`, com teste da função pura).

**Como escrever:** cada item é uma frase que a pessoa diria a um amigo, não um tópico de
apostila. "Dinheiro parado perde para a inflação" em vez de "Conceito de poder de compra".

**Critérios de aceite:** as 43 lições com resumo; teste do seed exige `summary` em toda lição;
regras de conteúdo passam sem crescer o baseline; `.docs/backend/lessons.md` documenta o campo.

- **Entregável:** (2026-10-18) `summary?: string[]` (2 a 3 itens, 1 a 120 caracteres) na raiz de `LessonBlocks`: tipo no domínio, Zod no backend (`lessonBlocksSchema`) e no espelho do frontend, `toPublicBlocks` repassa o campo, `CONTRACT_EXAMPLE` dos dois lados ganhou `summary`. Os 43 textos vivem em `backend/src/db/lessonSummaries.ts` (por `stableKey`) e entram no `LESSON_SEEDS` (que agora é o `BASE_LESSON_SEEDS` mapeado com o resumo); só repetem o que a lição já ensina, sem número regulatório novo. Script aditivo `src/db/addLessonSummaries.ts` (`fillSummary` pura, testada: preenche só onde falta, idempotente, preserva edição) aplicado no banco de desenvolvimento (43/43; segunda execução não faz nada). **Desvio do texto da tarefa:** o `summary` fica fora das fases, então em vez de ampliar `blockTextFields` criei `summaryTextFields` ao lado dela em `contentRules.ts`, usada por `visibleContent.test.ts` (mesmas regras de conteúdo proibido, baseline não cresceu). Teste do seed exige `summary` em toda lição e nenhuma chave órfã. `.docs/backend/lessons.md` documenta o campo e o script. Validado ponta a ponta: `docker compose up --build backend`, script no banco e `GET /lessons/:id` devolvendo o `summary`.

### LJ.1.6 · Sequência de acertos dentro da lição ✅ concluída

**O que fazer:** contador de acertos de primeira seguidos na sessão da lição. Ao chegar a 3 e a 5,
um selo curto e animado aparece junto do feedback do checkpoint ("3 de primeira seguidas!"), em
âmbar. Errar zera o contador **sem mensagem nenhuma** (nunca "você perdeu a sequência"). Não grava
nada e não muda XP.

**Criatividade:** o selo cresce com a sequência (3: chama pequena; 5: chama com brilho), usando o
mesmo ícone de chama do streak diário, para a pessoa ligar uma coisa à outra.

**Critérios de aceite:** não aparece em revisão; respeita `prefers-reduced-motion`; leitor de
tela anuncia em `aria-live="polite"`; teste da função pura do contador.

- **Entregável:** (2026-10-18) Função pura `features/lessons/answerStreak` (`nextStreak`, `streakMilestone`, com teste table-driven) e molécula `StreakSeal` (chama do streak diário, `aria-live="polite"`, aos 5 a chama ganha brilho; animação desligada com `prefers-reduced-motion`). `useCheckpoints` guarda o contador num `ref` (só memória da sessão da lição, nada vai ao servidor, XP intacto): acerto de primeira soma, qualquer outra resposta zera sem mensagem, e o selo só vem ao chegar exatamente a 3 e a 5 (`CheckpointView.streakMilestone`). Em revisão nem conta. Só as perguntas do bloco `check` entram; a aposta legada da Micro-decisão não. O `LessonPreview` do admin não tem sessão de resposta, então não muda. **Não conferi na tela:** o navegador de automação não conectou, então o selo só foi verificado pelos testes (página: selo em 3 e 5, erro zera em silêncio, revisão sem selo).

---

## Lote 2: perguntas que são jogo

Fundação primeiro (LJ.2.1); depois cada formato é independente. A ordem sugerida põe primeiro o
de maior efeito (estimativa) e por último o que exige tabela nova (enquete).

### LJ.2.1 · Fundação: checkpoint com vários formatos ✅ concluída

**Decisões aplicáveis:** LJ-D1, LJ-D2, LJ-D3 (fechadas).

**O que fazer (backend):**
- `CheckBlock` ganha os `kind` `estimate`, `order`, `categorize` e `match` (contrato de cada um
  nas tarefas abaixo); validação Zod em `infrastructure/content/lessonBlocks.ts` e no schema do
  frontend, com o teste de contrato espelhado que já existe (`CONTRACT_EXAMPLE`).
- `CheckResponse` vira união por formato: `selectedOption` (hoje), `value: number`
  (estimativa), `sequence: number[]` (ordenar), `groups: number[]` (agrupar), `pairs: number[]`
  (ligar). `isValidCheckResponse` e `isCheckCorrect` por formato, funções puras com testes
  table-driven.
- `toPublicBlock` nunca expõe gabarito: ordenar e ligar saem **embaralhados de forma
  determinística** (semente = id do checkpoint), para a revisão mostrar o mesmo embaralhamento.
- `AnswerCheckpointResult` ganha `hint?: { correctCount: number; total: number }` (LJ-D2) e
  `estimate?: { value, low, high }` só depois de responder (LJ-D1).
- Persistência: `user_lesson_checkpoints` ganha `last_response jsonb` (migration nova, journal
  com `when` maior que o último, ver memória do projeto); `wrong_options` continua só para
  `single`/`true_false`. Estimativa grava `solved_at` na primeira resposta.
- `contentRules.blockTextFields` varre as listas de texto dos formatos novos.
- `.docs/backend/lessons.md` atualizado (payload por formato, resposta, erros).

**O que fazer (frontend):** `LessonCheckpoint` vira um despachante por `kind`, cada formato num
componente próprio em `components/organisms/` (pasta por módulo, atomic design).

**Critérios de aceite:** checklist do backend completo; `single`/`true_false` sem mudança de
comportamento (testes atuais passam intactos); `docker compose up` de ponta a ponta.

- **Entregável:** (2026-10-18) **Escopo cortado de propósito:** a fundação entrou com o formato `estimate` (o único que a sessão usa); `order`, `categorize` e `match` ficam para a LJ.2.3 a LJ.2.5, que acrescentam o `kind`, o campo de resposta (`sequence`, `groups`, `pairs`), o embaralhamento determinístico e o `hint` da LJ-D2 junto do componente de cada um (código morto sem tela só adiantaria contrato que o formato pode mudar). Backend: `CheckBlock` ganha `estimate` (Zod com `min < max`, `answer` dentro da régua, `tolerancePct` em (0, 100]); `CheckResponse` vira `{ selectedOption? , value? }`; `isValidCheckResponse`/`isCheckCorrect` por formato, mais `classifyEstimate` (`exact`/`close`/`far`) e `resolvesOnFirstAnswer`, funções puras com teste table-driven; `toPublicBlock` leva só `range` da estimativa. `AnswerCheckpointResult` ganha `estimate: { guess, band, value, low, high }` (e a explicação sempre, porque avança). Persistência: coluna `user_lesson_checkpoints.last_response jsonb` (migration `0054`, escrita à mão com snapshot e `when` acima do último); o port aceita `solved`/`lastResponse`; `CheckpointRecord.lastResponse` alimenta o `firstTry` (estimativa "de primeira" = na mosca) e o `estimate` do `GET /lessons/:id` para restaurar a régua. Rota: corpo `{ selectedOption }` ou `{ value }` (Zod `union`). `.docs/backend/lessons.md` atualizado. Adapter testado em banco descartável (`drizzleLessonRepository.test.ts`, novo). `single`/`true_false` com testes antigos intactos. Frontend: `LessonCheckpoint` virou despachante por `kind`; o corpo antigo mudou para o organismo `ChoiceCheckpoint` (sem alteração de comportamento) e `useCheckpoints`/`answerCheckpoint` aceitam `CheckpointResponse`. Validado com `docker compose up --build backend`: migration aplicada no banco de desenvolvimento.

### LJ.2.2 · Formato estimativa (`estimate`) ✅ concluída

**Contrato:** `{ kind: 'estimate', prompt, min, max, step, unit: 'brl' | 'pct' | 'years' | 'none',
answer, tolerancePct, explanation }`.

**Experiência:** um controle deslizante grande, com o valor formatado ao lado (R$ 3.100) e campo
numérico para quem prefere digitar. Ao enviar, a régua mostra **duas marcas**: "Seu chute" e "O
valor real", com a faixa de tolerância sombreada entre elas, e uma frase pela distância:
- na faixa: "Na mosca!";
- perto (até 2x a tolerância): "Quase lá";
- longe: "Bem diferente do que parece, né?", seguido da explicação.

**Criatividade:** chutar errado aqui é o objetivo pedagógico. A pergunta é escolhida justamente
onde a intuição falha (crescimento exponencial, efeito de taxa pequena em prazo longo). Por isso
o tom da resposta longe nunca é de erro, é de descoberta.

**Critérios de aceite:** teclado (setas mudam por `step`, PageUp/PageDown por 10 passos); mobile
com alvo de toque de 44 px; testes da classificação na mosca/perto/longe e do formato de valor.

- **Entregável:** (2026-10-18) Organismo `EstimateCheckpoint` (despachado por `LessonCheckpoint`): controle deslizante de 44 px de altura, campo para digitar (aceita vírgula e ponto de milhar, recusa fora da régua com aviso) e Responder só depois de mexer. Resultado: frase por faixa ("Na mosca!", "Quase lá", "Bem diferente do que parece, né?"), régua com "Seu chute" em cima, "O valor real" embaixo e a faixa de tolerância sombreada, legenda com os três valores e a explicação; a chama de sequência aparece quando cai na mosca. Sempre avança (LJ-D1); o servidor devolve o valor real só depois, e o `GET` restaura a régua ao voltar. Funções puras com teste em `features/lessons/estimateScale` (formato por unidade, posição na régua, passo, PageUp/PageDown, leitura do texto digitado). A classificação na mosca/perto/longe é do servidor (`classifyEstimate`, LJ.2.1). `data-lesson-widget` no controle faz os atalhos do player cederem as setas; `data-lesson-submit` no Responder. O controle **começa no mínimo**, não no meio: o meio da régua ficava perto da resposta e induzia o chute (visto na tela). Schema do frontend ganhou `range`. **Conferência visual (2026-10-18):** desktop 1567 px, mobile 390 e tablet 820 (iframes de largura fixa na mesma aba) com usuário descartável (removido): controle, resultado e restauração ao reabrir. Não testei toque real em aparelho nem leitor de tela.

### LJ.2.3 · Formato ordenar (`order`)

**Contrato:** `{ kind: 'order', prompt, items: string[] (3 a 6), answer: number[] (permutação),
explanation, lowLabel?, highLabel? }`. Os rótulos de ponta ("Menos risco", "Mais risco") ficam
fixos no topo e no pé da lista, para a pessoa entender o eixo.

**Experiência:** arrastar no desktop e no toque; **botões subir/descer em cada item** como
alternativa obrigatória (teclado e quem não consegue arrastar). Erro: "3 de 5 no lugar certo"
(LJ-D2), sem marcar quais. Acerto: os itens se encaixam um a um, de cima para baixo.

**Critérios de aceite:** funciona só com teclado; sem dependência pesada de drag and drop (avaliar
API nativa de ponteiro antes de adicionar biblioteca); testes de correção e da contagem.

### LJ.2.4 · Formato agrupar (`categorize`)

**Contrato:** `{ kind: 'categorize', prompt, groups: string[] (2 ou 3), items: string[] (3 a 6),
answer: number[] (grupo de cada item), explanation }`.

**Experiência:** toque no item e depois no grupo (funciona igual no mobile, sem arrastar); o item
vai para a coluna escolhida e pode ser trocado antes de enviar. Desktop: grupos lado a lado; mobile:
grupos empilhados como "caixas" abaixo da pilha de itens. Erro: contagem (LJ-D2).

**Critérios de aceite:** só envia com todos os itens agrupados; teclado completo; testes.

### LJ.2.5 · Formato ligar pares (`match`)

**Contrato:** `{ kind: 'match', prompt, left: string[] (3 a 5), right: string[] (mesmo tamanho),
answer: number[] (índice da direita para cada esquerda), explanation }`.

**Experiência:** duas colunas; toca um da esquerda e um da direita. Par certo trava e ganha cor
neutra de "resolvido"; par errado treme e se desfaz (LJ-D3). Termina quando todos os pares travam.
Só nesse formato a resposta vai par a par ao servidor: `POST .../answer` com
`{ pairs: [[i, j]] }`, e o servidor confere cada par sem devolver o gabarito dos outros.

**Critérios de aceite:** teclado; tremor desligado em `prefers-reduced-motion` (troca por borda);
"de primeira" só se nenhum par falhou; testes.

### LJ.2.6 · Enquete da comunidade (`poll`)

**Decisão aplicável:** LJ-D5 (fechada).

**O que fazer:** novo **tipo de bloco** `poll` (não é `check`, não tem resposta certa):
`{ type: 'poll', id, prompt, options: string[] (2 a 4) }`. Tabela nova `lesson_poll_votes`
(`user_id`, `lesson_id`, `poll_id`, `option`, `created_at`, único por usuário e enquete); rota
`POST /lessons/:id/polls/:pollId/vote` (Zod, caso de uso, port, adapter, testes) que devolve a
distribuição em percentual **só quando o total passa de 20 votos** (LJ-D5). Não bloqueia o
Continuar; em revisão, mostra o próprio voto e o resultado atual.

**Experiência:** depois de votar, as barras crescem até os percentuais e o voto da pessoa fica
marcado: "62% fariam como você". A frase final conecta com a lição ("A maioria deixaria parado. Na
próxima tela você vê quanto isso custa").

**Critérios de aceite:** checklist do backend; nenhum dado individual sai na resposta; RNF09
intacta; `.docs/backend/lessons.md` documenta a rota.

### LJ.2.7 · Conteúdo: aplicar os formatos novos (parcial: só as linhas Estimativa ✅)

**Depende de:** as tarefas dos formatos usados.

**O que fazer:** trocar perguntas existentes (não somar: a lição fica com 3 a 7 checkpoints, como
manda a diretriz §7) pelos formatos abaixo, no seed e no banco (script aditivo por id do
checkpoint, com teste). Cada pergunta nova passa pelo checklist da diretriz.

| Formato | Lição | Pergunta |
|---|---|---|
| Estimativa | 0.2 Juros compostos | Quanto viram R$ 1.000 a 10% ao ano em 20 anos? (R$ 6.727; quase todo mundo chuta perto de R$ 3.000) |
| Estimativa | 0.3 Inflação | Com 5% ao ano, quanto custará em 10 anos algo de R$ 100 hoje? (R$ 162,89) |
| Estimativa | F.2 Dívida | R$ 1.000 no rotativo a 15% ao mês, sem pagar, quanto vira em 12 meses? (perto de R$ 5.350; mostrar que a lei limita os encargos ao valor original, então a dívida para em R$ 2.000) |
| Estimativa | 2.11 Custos | Quanto uma taxa de 2% ao ano come de R$ 10.000 em 30 anos? |
| Ordenar | 3.2 Perfil de risco | Do menos ao mais arriscado: Tesouro Selic, CDB de banco médio, FII, ação de empresa pequena |
| Ordenar | 1.6 IR regressivo | As faixas da maior alíquota para a menor, pelo prazo |
| Ordenar | 2.3 IPO | As etapas de uma oferta, da preparação à estreia na bolsa |
| Ordenar | 2.7.1 Balanço | A cascata do resultado: receita, lucro bruto, EBIT, lucro líquido |
| Agrupar | 1.1 Renda fixa | Renda fixa ou variável: Tesouro Selic, ação, CDB, FII, LCI |
| Agrupar | 2.12 Imposto | Isento ou tributado (com a regra dada no enunciado): LCI, CDB, venda de FII com lucro, poupança |
| Agrupar | 2.8 Setores | Cíclico ou defensivo: energia elétrica, construção, varejo de luxo, saneamento |
| Agrupar | F.1 Orçamento | Essencial, desejo ou futuro: aluguel, streaming, reserva de emergência, mercado |
| Ligar | 0.5 Juros | Selic, CDI, IPCA, TR com o que cada um mede |
| Ligar | 2.2 Tickers | Final 3, 4 e 11 com ON, PN e unit/ETF/FII |
| Ligar | 2.7.x Indicadores | P/L, ROE, margem, dívida líquida/EBIT com a pergunta que cada um responde |
| Enquete | 0.1 Investir | Com R$ 1.000 de bônus, você: deixa na conta, coloca na poupança, investe, gasta |
| Enquete | 1.3 Reserva | Hoje você teria quantos meses de gastos guardados? (nenhum, 1 a 2, 3 a 5, 6 ou mais) |
| Enquete | 3.4 Cabeça de investidor | Sua ação caiu 30% sem notícia nenhuma. Você vende, segura ou compra mais? |

Valores das estimativas conferidos por função pura no teste (não confiar na conta de cabeça).

**Critérios de aceite:** cada lição alterada continua dentro da diretriz (3 a 7 checkpoints,
cartão no teto, nenhum termo antes da definição); testes de conteúdo sem crescer baseline.

- **Entregável parcial (linhas Estimativa, 2026-10-18):** as 4 estimativas entraram trocando, no mesmo lugar, uma pergunta de alternativas de cada lição (contagem de checkpoints igual): 0.2 `simples-3-anos` virou `chute-20-anos` (R$ 6.727,50, régua R$ 1.000 a R$ 10.000, tolerância 10%); 0.3 `inflacao-8` virou `chute-preco-10-anos` (R$ 162,89, tolerância 5%, porque 10 anos de 5% simples dariam R$ 150 e isso deve ser "Quase lá", não "Na mosca"); F.2 `dois-meses` virou `chute-divida-12-meses` (R$ 5.350,25 a 15% ao mês; a explicação aponta o teto do rotativo que o texto seguinte explica, sem repetir número legal); 2.11 `retorno-liquido` virou `chute-taxa-30-anos` (quanto a taxa de 2% leva de R$ 10.000 a 10% em 30 anos: R$ 73.867,45). Os valores reais são conferidos por conta no teste (`applyEstimateChecks.test.ts`), não de cabeça. Script aditivo `src/db/applyEstimateChecks.ts` (`swapForEstimate` pura e idempotente, troca só o bloco pelo `id` antigo, preserva edição do painel) já aplicado no banco de desenvolvimento. **Pendente:** as linhas Ordenar, Agrupar, Ligar e Enquete (dependem de LJ.2.3 a LJ.2.6). Orçamento de cartão e termos conferidos pelos testes de conteúdo (baseline não cresceu). **Ponto a revisar pelo autor:** o chute da 2.11 sai depois do widget `fee-drag`, que já deixa explorar a conta; se preferir antes do widget, é só mover o bloco no seed.

---

## Lote 3: widgets com missão

### LJ.3.1 · Fundação: missão (`goal`) nos widgets ✅ concluída

**Decisão aplicável:** LJ-D4 (fechada).

**O que fazer:**
- Prop opcional `goal` em todo widget de conta: `{ text: string, metric: string, op: 'lt' | 'lte'
  | 'gt' | 'gte' | 'between', value?: number, min?: number, max?: number, reveal: string }`.
  `metric` é um nome que o widget declara (ex.: `realReturnPct`).
- Cada widget que aceita missão expõe as métricas por um callback `onMetrics` (as contas já vivem
  no frontend). O `LessonWidget` confere o `goal`, sem conhecer a fórmula de cada widget.
- Cartão com missão mostra no topo **"Missão: …"** com um alvo vazio; ao atingir, o alvo se
  preenche, aparece o texto `reveal` ("Isso: com a inflação acima do rendimento, você perde poder
  de compra") e o Continuar libera (LJ-D4).
- Saída "Me mostra" (LJ-D4): leva os controles ao valor-alvo, mostra o `reveal` e conta como
  "não de primeira" no placar.
- Zod do `goal` nos dois lados; `metric` validado contra a lista de métricas que o widget
  declara (teste que quebra se o widget renomear a métrica); `contentRules` varre `text` e
  `reveal`.

**Critérios de aceite:** missão atingida por teclado; anúncio em `aria-live`; widget sem `goal`
continua igual; placar (LJ.1.4) conta missões junto com checkpoints; testes da verificação.

- **Entregável:** (2026-10-18) **Contrato:** `goal` mora no **bloco** `widget` (ao lado de `props` e `caption`), não dentro das `props`: as props de cada widget são `strict` e a missão é do cartão, não da configuração do widget. Campos `{ text (até 120), metric, op, value?/min?/max?, reveal (até 280), showMe? }`; Zod nos dois lados (backend `infrastructure/content/lessonBlocks.ts`, frontend `widgets/schema` + `widgets/goal`), tipos e a lista de métricas em `domain/widgets/widgetGoal.ts` (`WIDGET_MISSION_METRICS`, espelhada no frontend). O backend recusa métrica que o widget não declara, `op` sem `value`, `between` sem limites ou invertido, e `showMe` que quebre as props do widget; `contentRules.blockTextFields` varre `goal.text` e `goal.reveal`. **"Me mostra" (LJ-D4) é um override de props:** `showMe` são props do widget que, mescladas às `props`, levam os controles ao alvo; o widget **remonta** com elas (`key` por rodada), então nenhum widget precisa de código para "ir ao alvo". **Frontend:** `LessonWidget` renderiza a faixa `WidgetMission` ("Missão: …" com alvo vazio que vira check; a revelação aparece em `role="status"`/`aria-live`) e entrega `onMetrics` ao widget; hook `useWidgetMission` (a missão só vale depois de ao menos uma interação, para widget que já nasce no alvo não contar de graça; "Me mostra" com 6 interações ou 2 min depois da primeira, sem cronômetro visível; `completed` em ref evita contar duas vezes). `onChangeCapture`/`onClickCapture` no contêiner contam as interações, sem depender de a métrica mudar. O player (`Lesson`) guarda o resultado por id do bloco (`missions`, só memória: sobrevive a Voltar, não a recarregar), trava o Continuar do cartão como checkpoint (`checkpointBlocking`; em revisão e em fase já alcançada não trava) e toca `playLessonCue('goal')` só quando atinge sozinho. **Placar e barra:** `scoredCardId` (check ou widget com `goal`) alimenta `progressMarkers` e `lessonScore`; "Me mostra" vale `later`, atingir sozinho vale `first-try`; em revisão a missão fica fora da conta (`undefined`), e missão que ficou para trás (lição retomada depois dela) também. `lessonDuration` conta missão como 45 s. **Widgets:** `growth-calculator` ganhou props iniciais opcionais (`initialCapital`, `monthlyContribution`, `ratePct`, `periodYears`) e a métrica `interestRatio` (juros compostos ÷ juros simples, 0 sem juros); `real-return` informa `realReturnPct`; `savings-vs-selic` informa `savingsGapPct` (Tesouro Selic líquido menos poupança, em % do valor aplicado). Teste de cada widget quebra se a métrica for renomeada (`LessonWidget/mission.test.tsx`). **Limite conhecido:** como a missão não grava no servidor, quem recarrega a página no meio da fase refaz a missão (ou usa "Me mostra"). **Conferido no navegador** (desktop, mobile 390 px e tablet 820 px por iframe) com a missão da 0.2 aplicada no banco de desenvolvimento (script da LJ.3.2): faixa no topo do widget, Continuar desabilitado, marco da barra âmbar ao atingir, "Me mostra" depois de 6 mexidas.

### LJ.3.2 · Missões na Trilha 0 ✅ concluída

**Depende de:** LJ.3.1.

| Lição | Widget | Missão | Revelação ao atingir |
|---|---|---|---|
| 0.2 | `growth-calculator` | "Ache o prazo em que o composto passa do dobro do simples" | Os juros sobre juros demoram para aparecer e depois disparam. |
| 0.4 | `real-return` | "Deixe o rendimento real negativo" | Rendeu no papel e perdeu no mercado: a inflação passou o rendimento. |
| 0.5 | `real-return` | "Ache a inflação em que 100% do CDI empata com ela" | Juro real zero: o dinheiro só não perde. |
| 0.6 | `savings-vs-selic` | "Ache a Selic em que a poupança chega mais perto do Tesouro" | Com juros baixos a regra dos 70% e a isenção de IR encurtam a diferença. |

Métricas novas nesses widgets com teste da fórmula; textos dentro do teto e da diretriz.

- **Entregável:** (2026-10-18) As quatro missões entraram no seed e no banco de desenvolvimento. **Ajustes sobre a tabela:** (a) a **0.5** (`juro-real`, `real-return`) fica com "Ache a inflação em que o juro real zera" (`realReturnPct` entre -0,1 e 0,1: o rendimento nominal também é um controle, então a missão vale pelo juro real, não por um CDI fixo); (b) a **0.6** usa `savingsGapPct` entre -0,25 e 0,25 (R$ 25 em R$ 10 mil) com "Ache a Selic em que a poupança e o Tesouro Selic rendem quase igual": com TR de 0,15% e 12 meses isso acontece perto de 10% (diferença de -R$ 9 em 10%, -R$ 89 em 9%, +R$ 71 em 11%, conferido por conta no teste), e a revelação diz que abaixo disso a poupança isenta passa na frente e acima o Tesouro vence, em vez do "juros baixos encurtam a diferença" do rascunho, que não era a leitura certa dos números; (c) a **0.2** usa `growth-calculator` com `initialCapital: 1000` (a calculadora nascia em branco e a razão não existe sem capital), métrica `interestRatio` ≥ 2, que com 10% ao ano e sem aporte acontece no 15º ano (razão 2,12; no 14º é 1,93); (d) a **0.4 não tinha widget** (era só texto e aposta): ganhou um `real-return` (`rendimento-real-8-6`, 8% de rendimento, 6% de inflação, "Deixe o rendimento real negativo") na Revelação, logo depois do texto que responde a aposta; a posição final dele é decisão da LJ.3.3. Cada missão leva `showMe` ("Me mostra") e a revelação do rascunho, ajustada. **Banco:** script aditivo `src/db/applyWidgetGoals.ts` (função pura `applyWidgetGoals`, idempotente: widget que já tem `goal` não é tocado; widget que não existe é inserido depois do bloco que o antecede no seed, com texto casando pelo conteúdo e, se o anterior sumiu, no fim da fase; preserva edição do painel) aplicado em desenvolvimento; a LJ.3.4 reaproveita o mesmo script. Testes: lógica do script, as quatro missões presentes e válidas no seed, valores do "Me mostra" cumprindo cada alvo por conta real dos widgets. Conferido no navegador: 0.2 (desktop, mobile, tablet) e o widget da 0.4 (desktop).

### LJ.3.3 · Problema primeiro nas lições de fórmula ✅ concluída

**Depende de:** LJ.3.2.

**O que fazer:** nas lições 0.2, 0.4 e 0.6, o widget com missão vem **antes** do texto que nomeia
a regra, e o texto passa a nomear o que a pessoa acabou de descobrir ("O que você viu tem nome:
rendimento real"). É a inversão do Brilliant: descobrir mexendo, ler depois. Aplicar no seed e no
banco (script aditivo por id de bloco). Conferir que nenhum termo aparece antes de ser
definido (`termPrerequisites`).

**Critérios de aceite:** número de cartões da lição não cresce; perguntas continuam fazendo
sentido na nova ordem; testes de conteúdo passam.

- **Entregável:** (2026-10-18) **0.2:** o widget com missão já vinha antes do texto que nomeia (a Revelação), então só mudaram dois textos: o convite da Aposta agora põe o problema ("Mexa no prazo da calculadora e alterne entre Simples e Composto para ver quando a diferença fica grande") e a abertura da fórmula nomeia a descoberta ("O que você viu tem nome: juros sobre juros"). **0.4:** o `real-return` com a missão foi para o **Cenário**, logo depois da história (8% de rendimento, 6% de inflação); o parágrafo que definia "nominal" e "real" saiu do Cenário e a definição ("O que você viu tem nome: rendimento real é o que sobra do rendimento nominal, o que a aplicação anuncia, depois de descontar a inflação") abre o cartão da Aposta, antes da pergunta que usa o termo. O widget nasce em 8% de rendimento e **3%** de inflação (não 6%) para não mostrar de graça a resposta da Aposta; id novo `rendimento-real`. **0.6:** o `savings-vs-selic` com missão passou da Revelação para o Cenário, entre a introdução e a regra; o texto da regra abre com "O que você viu tem nome: a regra de rendimento da poupança" e o widget nasce em Selic 6% (não 14%, que é o caso da Aposta). **Cartões:** Cenário, Aposta e Revelação ficam em 3/2/3 (0.2), 2/1/5 (0.4, igual ao original, a LJ.3.2 tinha acrescentado um) e 4/1/6 (0.6), conferido no teste (a Aposta e o total não crescem). **Banco:** `src/db/applyProblemFirst.ts` (operações cirúrgicas por `code` da lição, só mexem em texto exatamente como o seed antigo, depois `applyWidgetGoals` reposiciona o widget; idempotente, rodado duas vezes em desenvolvimento); a lógica pura do `applyWidgetGoals` foi para `widgetGoalsMigration.ts` porque o `main` dele encerra o processo e quebrava a importação. **Atenção:** a poupança tem `stableKey` '0.5' e `code` 0.6, e as operações são por `code`. Conferido no navegador: missão da 0.6 no Cenário, atingida pelo teclado (Selic em 10%) com o Continuar liberando. **Decisão do autor a conferir:** o rendimento real aparece no texto da missão da 0.4 ("Deixe o rendimento real negativo") antes da definição, que vem no cartão seguinte; o termo está escrito na barra do widget, mas se preferir missão em palavras comuns antes da definição, é só trocar o `text` do `goal`.

### LJ.3.4 · Missões nas Trilhas 1 a 3 e F

**Depende de:** LJ.3.1.

Uma missão por widget, escolhida para que atingir o alvo **seja** a lição:

| Lição | Widget | Missão |
|---|---|---|
| 1.3 | `emergency-fund-calculator` | Monte uma reserva de 6 meses com aporte que caiba em 12 meses |
| 1.5 | `fgc-coverage-bar` | Distribua R$ 600 mil sem deixar nada descoberto |
| 1.6 | `ir-regressive-table` | Ache o prazo em que a alíquota chega à menor faixa |
| 1.7 | `equivalent-rate` | Ache a taxa de CDB que empata com a LCI |
| 1.8 | `bond-price-calculator` | Faça o título custar menos de R$ 800 hoje |
| 1.9 | `mtm-seesaw` | Faça o seu título perder valor antes do vencimento |
| 1.11 | `ipca-plus-simulator` | Ache a inflação em que o IPCA+ passa o prefixado |
| 2.4 | `order-book` | Faça a sua ordem de compra ser executada |
| 2.7.1 | `interactive-balance` | Deixe o lucro líquido positivo só mexendo nos custos |
| 2.7.4 | `roe-lab` | Leve o ROE acima da Selic |
| 2.11 | `fee-drag` | Ache a taxa que come R$ 10 mil em 30 anos |
| 3.1 | `allocation-donut` | Monte uma carteira em que nenhum ativo passe de 40% |
| F.1 | `budget-split` | Feche o mês com 10% de sobra |
| F.2 | `debt-snowball` | Quite a dívida em menos de 12 meses |

Um commit por widget (métrica + teste + conteúdo). Valores-alvo conferidos com a fórmula do
próprio widget no teste.

---

## Lote 5: o resto que melhora a experiência

Itens independentes entre si (exceto onde a dependência está dita). O LJ.5.1 vem primeiro porque é
o que mede se o resto funcionou.

### LJ.5.1 · Funil por cartão no painel admin (medir antes de mexer) ✅ concluída

**O que fazer:** gravar quando a pessoa **chega** a cada cartão de uma lição (lição, fase, índice
do cartão, dia), agregado por dia sem guardar a sequência individual além do necessário: tabela
`lesson_card_reach` (`lesson_id`, `phase`, `card_index`, `day`, `reached_count`), incrementada
uma vez por usuário e cartão (usar `user_lesson_progress` + o maior cartão já alcançado para não
contar a mesma pessoa duas vezes). Rota `POST /lessons/:id/progress` já existe para a fase; a
granularidade por cartão vai no mesmo envio ou numa rota leve nova (Zod, caso de uso, port,
testes). No painel admin, uma tela "Funil da lição": barras por cartão mostrando quantos chegaram,
com o cartão de maior queda destacado.

**Por quê:** a proposta lista "abandono no meio" como sinal de validação, e hoje ele não existe.
Sem isso, não dá para saber se o Lote 1 a 3 melhorou alguma coisa nem qual lição ainda está longa.

**Critérios de aceite:** checklist do backend; só `role = admin` lê; sem dado individual na tela;
funciona para lição legada sem `blocks`; `.docs/backend/lessons.md` e a doc do admin atualizadas.
Se o painel de retenção (frente RT) já existir na branch, a tela entra ao lado dele.

- **Entregável:** (2026-10-18) O painel de retenção (frente RT) não existe nesta branch, então a tela é página própria: `/admin/conteudo/:id/funil` (link "Funil" na linha de cada lição da tabela de Conteúdo), com janela de 7/30/90 dias, uma barra por cartão (fase + número), o cartão de maior queda marcado com tracejado e selo "Maior queda" (nunca só cor) e resumo ao lado no desktop (2 colunas a partir de 1024px; no mobile o nome fica sobre a barra). Backend (módulo `lessons`): `POST /lessons/:id/cards/reached` `{ phase 0..3, cardIndex 0..59 }` → `{ recorded }` (`RecordCardReachUseCase`, porta `LessonCardReachRepository`, adapter Drizzle); `GET /admin/lessons/:id/card-funnel?days=` (`GetLessonCardFunnelUseCase` + caso de uso/adapter do `admin`, sem auditoria por ser leitura). Função pura `buildCardFunnel` em `domain/cardReach.ts` (soma os dias, ordena, mede queda por cartão e aponta a maior, em pessoas). Migration `0053_add_lesson_card_reach` (journal `when` 1794500000000, acima da 0052): `lesson_card_reach` (agregado por lição/fase/cartão/dia, sem usuário) e `user_lesson_card_progress` (cartão mais avançado por pessoa).
  - **Desvio do texto da tarefa (decisão técnica):** o "maior cartão já alcançado" não foi para `user_lesson_progress`, e sim para a tabela própria `user_lesson_card_progress`. Gravar lá obrigaria a criar linha de progresso só por abrir a lição, o que mudaria o "iniciaram" do funil por lição e o status do mapa. O dedupe é um upsert condicionado (`setWhere` com comparação de tupla fase/cartão) dentro de uma transação, então envios concorrentes da mesma pessoa contam uma vez (teste de integração com 8 chamadas simultâneas).
  - **Regras do servidor:** fase maior que o `currentStep` gravado é `422 step_out_of_order`; lição bloqueada é 404; lição já concluída é aceita de propósito, porque a tela final só aparece depois de o servidor concluir a lição (é assim que ela entra no funil). A revisão não é medida porque o player não reporta quando `isReview`. Frontend: hook `useCardReach` (fire-and-forget, dedupe local, teto 59), ligado em `pages/Lesson`.
  - **Limites da medição (documentados em `.docs/backend/admin.md`):** conta a partir do deploy; quem retoma a lição no meio entra a partir de onde parou (a queda é truncada em 0); o índice é o do player no momento, então depois de editar o texto de uma lição o histórico antigo deixa de corresponder (usar janela curta). A tela rotula o cartão por fase e posição, sem o texto dele, porque o painel não carrega `blocks` e quem fatia o texto em cartões é o cliente.
  - **Testes/validação:** backend lint, build e `npm test` (4324 passam); integração do adapter contra banco descartável; frontend `tsc`, oxlint, prettier e vitest (4324 passam no total). Ponta a ponta com `docker compose up --build backend` (migration aplicada no boot) e o frontend local: POST contando uma vez, 422 de fase à frente, 400 de payload, tela do funil em desktop (2 colunas) e mobile 400px, e o player reportando o cartão ao avançar. `.docs/backend/lessons.md` e `.docs/backend/admin.md` atualizados.

### LJ.5.2 · Tempo estimado da lição ✅ concluída

**O que fazer:** função pura que estima a duração pela quantidade de cartões, caracteres e
interações (texto: caracteres ÷ 15 por segundo; pergunta: 15 s; widget: 30 s; missão: 45 s;
arredondado para minutos, mínimo 2). Mostrar "~4 min" no nó do mapa da trilha (`LessonNode`), no
`ResumeLessonCard` e no primeiro cartão da lição. Ao retomar uma lição pela metade: "Faltam ~2
min".

**Criatividade:** quando o funil (LJ.5.1) tiver dados, a estimativa passa a usar a mediana real
de quem concluiu, e a função pura vira só o valor de partida.

**Critérios de aceite:** teste da função com lições reais do seed; nada de "min" em texto de
lição (é dado de interface, não conteúdo).

- **Entregável:** (2026-10-18) `features/lessons/lessonDuration`: `cardSeconds` (texto: caracteres sem marcação ÷ 15; pergunta 15 s; widget de ferramenta 30 s; `callout` e `platform-note` contam como leitura), `lessonMinutes(lesson, fromStep)` (arredonda, mínimo 2; lição sem `blocks` usa o texto legado e a aposta legada conta como uma interação) e `durationLabel` ("~4 min" ou "Faltam ~2 min" quando `currentStep` > 0). **Decisão sobre `footnotes`:** o rodapé "Na plataforma" é recolhido e opcional, então **não** entra na conta (documentado no código). Missão de widget (45 s) entra com a LJ.3. Onde aparece: nó do mapa da trilha (`TrackPath`: linha própria e `statusLabel`, que também alimenta o `LessonNode` de trilha com uma lição só; nó concluído e bloqueado não mostram), `ResumeLessonCard` ("Trilha · ~4 min") e primeiro cartão da lição, com "Faltam" no primeiro cartão da fase em que a pessoa retomou (fase guardada na abertura, para não reaparecer a cada avanço). Teste com três lições reais do seed (fixture `seedLessons.fixture.json`: 0.1, 1.12 e 2.12). Hoje as 43 lições ficam entre 2 e 4 min. A mediana real do funil (LJ.5.1) como substituta da fórmula **não** foi feita: espera haver dados.

### LJ.5.3 · Gestos e atalhos para avançar ✅ concluída

**O que fazer:** no mobile, **deslizar para a esquerda** avança e para a direita volta (só quando
o Continuar estaria habilitado, ou seja, nunca pula checkpoint ou missão). No desktop, **Enter** e
**seta para a direita** avançam, seta para a esquerda volta; os números 1 a 4 escolhem alternativa
no checkpoint de múltipla escolha. Os atalhos não disparam dentro de campo de texto, controle
deslizante ou widget com foco.

**Critérios de aceite:** dica discreta dos atalhos na primeira lição só no desktop ("Dica: Enter
avança"), uma vez por pessoa (preferência local); gestos não brigam com o scroll vertical nem com
widgets arrastáveis (ordenar, agrupar); testes dos atalhos.

- **Entregável:** (2026-10-18) `lessonShortcuts` (decisão pura de tecla e de gesto) + hook `useLessonShortcuts` (clica nos botões reais `data-lesson-*`, então herda o `disabled` e nunca pula pergunta): setas, Enter (responde se há alternativa marcada, senão avança), 1 a 4 escolhem alternativa; deslizar à esquerda avança e à direita volta (60 px, 2:1 horizontal, até 800 ms; ignora pinça, widget, campo e área com rolagem horizontal). Nada dispara em campo, widget com foco (`data-lesson-widget` na figura do widget), com modificador ou com janela aberta por cima. Enter em botão fica com o botão. Dica "Dica: Enter avança..." só com mouse e teclado, uma vez por pessoa (`selucra:lesson-shortcut-hint-seen`, try/catch). Corrigido de passagem: o aviso de erro do `LessonCheckpoint` saía com aspas literais.


### LJ.5.4 · Som e vibração no acerto (opcional) ✅ concluída

**O que fazer:** acerto de checkpoint, missão atingida e conclusão da lição ganham um **som curto**
(arquivo local, até 20 KB cada, gerado ou com licença livre registrada no repositório) e uma
**vibração curta** (`navigator.vibrate`, onde existir). Preferência em "Configurações": som
**desligado** por padrão, vibração **ligada** por padrão no celular. Nunca som de erro: erro é
silencioso.

**Critérios de aceite:** sem som em revisão; o service worker pré-carrega os arquivos de som como
asset com hash (nunca rota de API, regra do PWA); respeita `prefers-reduced-motion` para a
vibração; preferência gravada só no navegador (hoje só existe `email_preferences`, e uma
preferência de som não justifica tabela nova), com leitura em try/catch.

- **Entregável:** (2026-10-18) `features/lessons/lessonFeedback`: `playLessonCue('correct' | 'goal' | 'complete')`, preferências (`readLessonFeedbackPrefs`/`writeLessonFeedbackPref`, chaves `app.lesson.sound` e `app.lesson.vibration` em `STORAGE_KEYS`, leitura em try/catch; padrão som desligado e vibração ligada) e vibração só com `navigator.vibrate` e sem `prefers-reduced-motion`. Três WAV (6,8, 12,2 e 19,2 KB) gerados por `frontend/scripts/generateLessonSounds.py` (ondas senoidais, sem amostra de terceiros, então não há licença a registrar); entram no build com hash e o glob do precache do service worker ganhou `wav` (conferido no `sw.js` gerado: 3 entradas). Acerto de pergunta (em `useCheckpoints`) e conclusão da lição (primeira vez que chega à tela final, em `Lesson`) disparam o cue; erro e revisão são silenciosos. Seção "Lições" em Configurações (`LessonFeedbackSection`, reusa `EmailCategoryOption`; ligar toca uma amostra; a vibração some onde o aparelho não vibra). **Pendente para a LJ.3:** o cue `goal` (missão atingida) existe e tem som, mas nenhum widget tem missão ainda; quem implementar a missão chama `playLessonCue('goal')`. Não conferi na tela (navegador de automação indisponível); nem o som nem a vibração foram ouvidos/sentidos em aparelho real.

### LJ.5.5 · "Relembra?": uma pergunta de lição anterior no início

**O que fazer:** a partir da segunda lição de cada trilha, o primeiro cartão é uma pergunta de uma
lição **já concluída**, escolhida pelo servidor entre os checkpoints em que a pessoa errou ao
menos uma vez (se não houver, um aleatório de 2 a 5 lições atrás). Não conta no placar da lição
atual, não bloqueia se errar (mostra a explicação e segue) e não muda XP.

**Contrato:** `GET /lessons/:id` passa a devolver `recall?: { lessonTitle, block: PublicCheckBlock }`;
a resposta usa a rota de checkpoint que já existe, apontando para a lição de origem (que já está
concluída, então a gravação é só leitura, como na revisão).

**Criatividade:** o cartão tem cara própria (selo "Relembra?" e o título da lição de origem), e
acertar mostra "Isso ficou!", ligando à ideia de memória.

**Critérios de aceite:** checklist do backend; nunca escolhe pergunta de lição não concluída;
determinístico por usuário e dia (recarregar não troca a pergunta); testes do sorteio.

### LJ.5.6 · Revisão de 1 minuto (perguntas erradas voltam espaçadas)

**Depende de:** LJ.5.5 (mesma seleção de pergunta).

**O que fazer:** cada checkpoint que a pessoa acertou só depois de errar entra numa fila de
revisão com retorno em 1, 3 e 7 dias (`review_stage`, `review_due_at` em
`user_lesson_checkpoints`, migration nova). No hub da trilha aparece o cartão **"Revisão de 1
minuto: 3 perguntas"** quando houver pelo menos 3 vencidas. Acertar avança o estágio; errar volta
ao primeiro, sem perder nada. Concluir conta para a missão diária de revisão (H.2) se a regra dela
permitir; se não, registrar em `pontos-em-aberto-decisao-produto.md` em vez de mudar a missão.

**Por quê:** é a prática com mais evidência de retenção (recuperação espaçada), e a fila sai do
dado que já existe (quem errou antes de acertar).

**Critérios de aceite:** nunca vira cobrança (sem contador vermelho, sem "atrasada"); checklist do
backend; rota documentada; testes do agendamento.

### LJ.5.7 · Lições longas: caminho principal até 12 cartões, resto em "Saiba mais" (parcial: mecanismo ✅, teto de 12 não alcançado)

**O que fazer:** novo tipo de bloco `more` (`{ type: 'more', id, title, blocks: LessonBlock[] }`,
sem checkpoint dentro) renderizado como `<details>` recolhido no cartão anterior, igual ao
rodapé do LJ.1.3. Aplicar nas 7 lições que passam de 15 cartões (2.4, 2.12, F.2, 1.11, 1.12,
2.7.6, 2.10): o que é detalhe (exceção de regra, caso histórico, número complementar) vai para
"Saiba mais", e o caminho principal fica com até 12 cartões. Script aditivo para o banco.

**Critérios de aceite:** nenhuma informação removida, só movida; `contentRules` varre o conteúdo
de `more`; teste do seed acusa lição com mais de 12 cartões no caminho principal (baseline com as
que ainda não foram tratadas, no molde dos testes de conteúdo).

- **Entregável parcial (2026-10-18):** **Mecanismo:** bloco `more` (`{ type, id, title (até 60), blocks }`, 1 a 4 blocos de texto ou widget sem missão; sem pergunta, sem outro `more`, nunca primeiro bloco da fase), tipo no domínio, Zod no backend (ids de dentro entram na checagem de id único) e no espelho do frontend. `buildPhaseCards` cola o `more` no cartão anterior (`PlayerCard.more`), como o rodapé "Na plataforma", então não conta na barra, no placar nem no tempo estimado; sem cartão a que se colar vira cartões (nada some). Organismo `MoreDetails` (`<details>` recolhido, "Saiba mais" + título, conteúdo montado só aberto para widget não buscar dado à toa; aberto/fechado guardado junto com os rodapés). `contentRules.blockTextFields` varre título e conteúdo sem o teto de cartão; `legacyText` inclui o texto no lugar do bloco; `countMainPathCards` (espelho do player) e teste do seed com baseline por lição (catraca, 15 lições acima de 12). Script aditivo `src/db/applyMoreBlocks.ts` (`applyMoreBlocks` pura e idempotente, só move o que encontra), aplicado no banco de desenvolvimento. **Conteúdo movido (6 cartões):** 2.4 pregão e custos, 2.7.6 frequência do provento, 2.12 dedo-duro e limites de hoje, F.2 taxas de hoje. Contagens: 2.4 17 para 15, 2.12 18 para 16, F.2 17 para 16, 2.7.6 15 para 14; **1.11, 1.12 e 2.10 não foram tocadas** (o que sobraria como detalhe está amarrado a uma pergunta). **O teto de 12 não foi alcançado nas 7 lições** e isso é decisão do autor: ponto 057 de `pontos-em-aberto-decisao-produto.md` (opções: dividir lições, subir o teto, pergunta opcional dentro do "Saiba mais", tirar o cartão "Completar esta lição libera..."). `.docs/backend/lessons.md` documenta o bloco e o script. **Ponto 057, opção (d) aplicada (2026-10-18):** o cartão final "Completar esta lição libera..." saiu de 6 lições (1.2, 1.5, 1.7, 1.8, 1.11, 1.12; a tela final já mostra o `unlocksDescription`) e dois pares de cartões curtos da 2.10 foram fundidos (`src/db/applyTrimCards.ts`, pura e idempotente, aplicada em desenvolvimento). 1.5 e 1.7 chegaram a 12; 1.11 15, 1.12 14, 2.10 13. Continuam acima de 12: 2.4, 2.12, F.2, 2.7.6 e as acima, à espera de dividir lições ou subir o teto. Conferido no navegador (desktop e mobile 390 px por iframe) na 2.4 com usuário descartável (removido): recolhido sob o cartão dos lotes, abre com os dois parágrafos.

### LJ.5.8 · Gancho no primeiro cartão das 43 lições

**O que fazer:** revisar o primeiro cartão de cada lição para abrir com **pergunta, número
surpreendente ou situação**, nunca com definição. Exemplos do tom:
- 1.6 IR regressivo: "Dois amigos aplicaram o mesmo valor no mesmo CDB. Um pagou 22,5% de imposto,
  o outro 15%. O que um fez diferente do outro?"
- 2.7.5 P/L: "Uma ação de R$ 10 pode ser mais cara que uma de R$ 100. Como?"
- 3.4 Cabeça de investidor: "Você vende uma ação na baixa e ela sobe 40% no mês seguinte. Quanto
  isso dói, de 0 a 10?"

Texto pelo seed e script aditivo; checklist da diretriz em cada lição.

**Critérios de aceite:** nenhuma lição abre com "X é..."; nenhum termo antes da definição;
testes de conteúdo sem crescer baseline.

### LJ.5.9 · Coleção de termos no Perfil

**O que fazer:** cada termo do glossário (`features/lessons/glossary`) vira uma **carta** que a
pessoa ganha ao concluir a lição que o define (`termPrerequisites.ts` já diz qual é). No Perfil,
uma seção "Seus termos: 23 de 61", com as cartas ganhas viradas para cima (termo + definição
curta) e as que faltam viradas para baixo, mostrando só a trilha onde se ganha. Tocar numa carta
ganha abre a definição e o atalho "Rever a lição".

**Por quê:** dá posse ao que foi aprendido (Impulso 4) e cria um motivo visível para completar a
trilha, sem nenhuma recompensa nova de XP.

**Critérios de aceite:** derivado do progresso (sem tabela nova); no perfil público aparecem a
contagem e as cartas já ganhas (LJ-D6), nunca as que faltam; três breakpoints; testes da
derivação, incluindo a rota do perfil público.

### LJ.5.10 · Compartilhar o resultado

**O que fazer:** botão "Compartilhar" na tela final (LJ.1.4) e no resultado da estimativa
(LJ.2.2), reaproveitando o gerador de imagem da retrospectiva
(`features/retrospective/shareCard`) e o `navigator.share` com texto de fallback. Conteúdo do
cartão: título da lição, placar ("5 de 5 de primeira") ou o chute da estimativa ("Chutei R$ 3.100.
Era R$ 6.727."), e o link de convite da pessoa (`/convidar`).

**Critérios de aceite:** nunca patrimônio, posição nem rentabilidade (RNF09); funciona sem
`navigator.share` (copia o texto); identidade visual dos tokens; testes do texto gerado.

---

## Sequência sugerida

1. **LJ.5.1** (funil por cartão: medir antes de mudar)
2. LJ.1.1, LJ.1.2, LJ.1.3, **LJ.5.3** (ritmo e navegação: efeito em todas as lições)
3. LJ.1.5 e LJ.1.4 (placar precisa do resumo para ficar completo), **LJ.5.2**
4. LJ.1.6, **LJ.5.4**
5. LJ.2.1, LJ.2.2 e a linha "Estimativa" da LJ.2.7 (o formato de maior efeito, já na 0.2)
6. LJ.3.1, LJ.3.2, LJ.3.3 (Trilha 0 inteira jogável)
7. **LJ.5.7, LJ.5.8** (conteúdo: lições longas e ganchos)
8. LJ.2.3, LJ.2.4, LJ.2.5, o resto da LJ.2.7
9. **LJ.5.5, LJ.5.6** (memória: "Relembra?" e revisão espaçada)
10. LJ.2.6 (tabela nova), **LJ.5.9, LJ.5.10**
11. LJ.3.4

## Resumo de contagem

| Lote | Tarefas |
|---|---|
| 1 Ritmo do player | 6 (LJ.1.1 a LJ.1.6) |
| 2 Perguntas que são jogo | 7 (LJ.2.1 a LJ.2.7) |
| 3 Widgets com missão | 4 (LJ.3.1 a LJ.3.4) |
| 5 O resto que melhora a experiência | 10 (LJ.5.1 a LJ.5.10) |
| Decisões | 6 (LJ-D1 a LJ-D6), todas fechadas em 2026-10-17 |
| Fora deste backlog | personagem da Trilha 0 (proposta 4.1), à espera do teste do autor |
