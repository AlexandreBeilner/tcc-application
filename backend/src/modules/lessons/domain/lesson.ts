import { classifyEstimate, findCheckBlock, toPublicBlocks } from './widgets/lessonBlocks'
import type { EstimateResult, LessonBlocks, PublicLessonBlocks } from './widgets/lessonBlocks'
// Dia calendário em UTC, formato YYYY-MM-DD — reexportado daqui (usado pra
// comparar a data de `completedAt`, missões 5.4 precisam saber "concluiu uma
// lição hoje") pra manter o import existente em `application/`; implementação
// real em `shared/utcDate.ts`, compartilhada com `gamification`/`missions`.
export { utcDateString } from '../../../shared/utcDate'

export const LESSON_UNLOCK_STEP = 3

// Tempo mínimo entre dois avanços de passo da mesma lição (S.4/achado 020) —
// sem isto, a trilha inteira (35 lições, 1.750 XP, todos os produtos
// liberados) era concluível por script em ~1 s. Ajustável em produção via
// `LESSON_MIN_STEP_INTERVAL_MS` (composição em `app.ts`).
export const LESSON_MIN_STEP_INTERVAL_MS = 5000

// Ilustrativo, sujeito à calibração da tarefa 8.1 — mesmo tratamento dado às
// demais constantes de gamificação (curva de xp da 5.1, recompensa de
// missão da 5.4). Lições concedem uma recompensa flat, ao contrário de
// `daily_missions` (que tem `xp_reward` por linha) — o currículo não
// distingue "peso" pedagógico entre lições nesta fase.
export const LESSON_XP_REWARD = 50

export type LessonStatus = 'completed' | 'available' | 'locked'

// Widget do passo Micro-decisão (spec 5.2, tarefa 7.0.2) — espelha o enum
// `lesson_micro_decision_type` do schema. 'reflection' é o padrão (sem widget
// embutido); os outros embutem um componente já existente (tarefa 6.7) no
// frontend, junto da pergunta.
export type MicroDecisionType =
  | 'reflection'
  | 'growth_calculator'
  | 'fixed_income_comparison'
  | 'live_indicator'
  | 'live_macro_indicator'

// Progressão linear sobre as lições da trilha, na ordem de `sortOrder` (spec
// 5.1) — cada trilha só desbloqueia a próxima na última lição, sem
// pré-requisito ramificado/paralelo modelado (decisão de escopo, backlog
// tarefa 5.6). Desde a N.24 a posição de uma lição é o índice dela entre as
// lições da lista recebida (não o `sortOrder` cru), e o avanço do usuário é
// "quantas lições ele satisfez" (concluídas ou dispensadas), não "quantas
// concluiu". Isso permite criar/despublicar lição no meio sem bloquear nem
// fazer pular ninguém: a lista recebida deve ser só das lições publicadas.
//
// Trilhas paralelas (RC.4.4, decisão D13): a Trilha F "Finanças do dia a dia"
// fica fora dessa corrente. Suas lições estão sempre disponíveis, em qualquer
// ordem, não contam para `satisfiedCount` (nem para as chaves de produto que
// ele libera) e não bloqueiam nem dispensam ninguém quando entram. Ficam no fim
// do `sortOrder` para nunca caírem "no meio" da corrente.
export const PARALLEL_TRACK_NUMBERS: readonly number[] = [4]

export function isParallelTrack(trackNumber: number): boolean {
  return PARALLEL_TRACK_NUMBERS.includes(trackNumber)
}

export function isUnlocked(position: number, satisfiedCount: number): boolean {
  return position <= satisfiedCount + 1
}

// "Satisfeita" = concluída de verdade ou dispensada (N.24). Dispensa não dá
// XP nem conta pra `countCompleted`; só deixa de bloquear a sequência.
export function isSatisfied(
  progress: Pick<LessonProgressSnapshot, 'completedAt' | 'waivedAt'>,
): boolean {
  return progress.completedAt !== null || progress.waivedAt !== null
}

// Estado de progressão de um usuário sobre a lista de lições publicadas.
// Construído uma vez por requisição e consultado por lição — única fonte da
// regra de desbloqueio (`getTrackMap`, `getLesson`, `advanceLesson`,
// `getUnlockedProductKeys`), pra os gates não divergirem entre si.
export interface Progression {
  satisfiedCount: number
  // `false` também pra lição fora da lista (despublicada/inexistente): sem
  // posição não há como estar desbloqueada.
  isUnlocked(lessonId: string): boolean
}

export function buildProgression(
  lessons: Pick<LessonSummary, 'id' | 'sortOrder' | 'trackNumber'>[],
  progress: (Pick<LessonProgressSnapshot, 'completedAt' | 'waivedAt'> & { lessonId: string })[],
): Progression {
  const parallelIds = new Set(
    lessons.filter((lesson) => isParallelTrack(lesson.trackNumber)).map((lesson) => lesson.id),
  )
  const ordered = lessons
    .filter((lesson) => !parallelIds.has(lesson.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const positionById = new Map(ordered.map((lesson, index) => [lesson.id, index + 1]))
  // Só conta progresso de lição que está na lista: lição despublicada sai da
  // conta de todos, inclusive de quem a tinha concluído.
  const satisfiedCount = progress.filter(
    (p) => positionById.has(p.lessonId) && isSatisfied(p),
  ).length

  return {
    satisfiedCount,
    isUnlocked(lessonId) {
      if (parallelIds.has(lessonId)) return true
      const position = positionById.get(lessonId)
      return position !== undefined && isUnlocked(position, satisfiedCount)
    },
  }
}

// Quem já satisfez a lição que ocupava a posição de inserção (ou qualquer
// posterior) já passou daquele ponto: recebe a dispensa da lição nova. Quem
// estava exatamente nessa posição (próxima a fazer) ou antes não recebe e é
// bloqueado por ela normalmente. `insertionPosition` é 1-based, a posição que
// a lição nova passa a ocupar. Consumida pela criação de lição (N.23).
export function shouldWaiveInsertedLesson(
  satisfiedCount: number,
  insertionPosition: number,
): boolean {
  return satisfiedCount >= insertionPosition
}

export function lessonStatus(input: { unlocked: boolean; completedByUser: boolean }): LessonStatus {
  if (input.completedByUser) {
    return 'completed'
  }
  return input.unlocked ? 'available' : 'locked'
}

export interface LessonSummary {
  id: string
  code: string
  title: string
  trackNumber: number
  trackName: string
  sortOrder: number
  centralConcept: string
  // Conteúdo pedagógico real por passo (spec 5.2, tarefa 7.0.2) — antes só
  // `centralConcept` existia e era reaproveitado nos 3 primeiros passos.
  scenarioText: string
  microDecisionPrompt: string
  microDecisionType: MicroDecisionType
  microDecisionAssetTicker: string | null
  revelationText: string
  unlocksDescription: string | null
  // Vocabulário fixo (tarefa 7.0.1): 'portfolio', 'calculator', 'news_feed'
  // ou 'asset:<AssetType>'. Ver `unlockedKeysFor` abaixo — normalmente [].
  unlocksKeys: string[]
  // Preenchido só quando unlocksKeys inclui um `asset:*` — ticker real do
  // produto recém-desbloqueado, usado pelo CTA "Comprar agora" do passo
  // Desbloqueio (tarefa 7.0.2, achado 6).
  unlocksAssetTicker: string | null
  // Aposta com acerto/erro real (backlog engajamento B.1) — `null` nos dois
  // campos é o estado normal de hoje (passo Micro-decisão sem
  // pergunta); só uma lição com as duas colunas preenchidas (autoria é
  // a B.4) troca pro widget de escolha real (B.3).
  microDecisionOptions: string[] | null
  microDecisionCorrectOption: number | null
  // Conteúdo visual por fase (RC.3.1). Ausente/`null` = player usa os textos
  // legados acima. Já validado: valor fora do contrato chega aqui como `null`.
  blocks?: LessonBlocks | null
}

export interface LessonProgressSnapshot {
  currentStep: number
  completedAt: Date | null
  // Instante da última gravação de passo (`user_lesson_progress.updated_at`) —
  // base do tempo mínimo entre avanços (S.4).
  updatedAt: Date
  // Índice escolhido pelo usuário na Micro-decisão (B.1) — `null` até a
  // escolha ser gravada (B.2) ou pra lição sem aposta real.
  microDecisionSelectedOption: number | null
  // Pergunta que só avança ao acertar (RC.2.3): nº de respostas dadas,
  // alternativas erradas já tentadas e instante do acerto (`null` = ainda não
  // resolvida). `microDecisionSelectedOption` acima é a PRIMEIRA escolha.
  microDecisionAttempts: number
  microDecisionWrongOptions: number[]
  microDecisionSolvedAt: Date | null
  // Dispensa (N.24) — `null` pra quem nunca foi dispensado da lição.
  waivedAt: Date | null
}

// Três estados, não booleano: `null` cobre tanto "lição sem aposta real
// ainda" (`lesson.microDecisionCorrectOption === null`, checkbox de hoje)
// quanto "usuário não escolheu nada" — nenhum dos dois é "errou", que só
// faz sentido quando existe uma escolha real pra comparar.
export function isCorrectOption(
  lesson: Pick<LessonSummary, 'microDecisionCorrectOption'>,
  selectedOption: number | null,
): boolean | null {
  if (lesson.microDecisionCorrectOption === null || selectedOption === null) {
    return null
  }
  return selectedOption === lesson.microDecisionCorrectOption
}

// `microDecisionCorrectOption` de fora deliberadamente (correção da revisão
// da PR 18): a versão original espelhava `LessonSummary` inteiro, incluindo
// o índice certo, em todo `GET /lessons`/`GET /lessons/:id` — qualquer
// usuário podia ler a resposta certa da aposta antes de escolher, só abrindo
// a aba de rede. `AdvanceLessonUseCase` devolve o resultado (`correct`/
// `correctOptionLabel`, via `microDecisionResultFor` abaixo) só na resposta
// do `POST` que de fato inclui a escolha do usuário.
// Estado gravado de uma pergunta intermediária (`check`, RC.3.2) pro usuário.
export interface CheckpointRecord {
  checkpointId: string
  attempts: number
  wrongOptions: number[]
  solvedAt: Date | null
  // Resposta dos formatos que não são por índice (LJ.2.1). Estimativa: o chute e se caiu na
  // tolerância ("na mosca"). `null` em `single`/`true_false`.
  lastResponse?: CheckpointLastResponse | null
}

// Estimativa: o chute e se caiu na tolerância. Ordenar: a ordem certa que a pessoa montou (só gravada ao
// resolver, para restaurar a tela).
export type CheckpointLastResponse =
  { kind: 'estimate'; value: number; hit: boolean } | { kind: 'order'; sequence: number[] }

// Estado de uma pergunta intermediária (RC.3.2) pro player restaurar a tela;
// o gabarito nunca vai aqui.
export interface CheckpointState {
  checkpointId: string
  solved: boolean
  attempts: number
  wrongOptions: number[]
  firstTry: boolean
  // Só estimativa já respondida: o chute, o valor real e a faixa (restaura a régua da tela).
  estimate?: EstimateResult
  // Só ordenar já resolvido: a ordem montada (índices dos itens como o cliente os recebeu).
  sequence?: number[]
}

export interface LessonView extends Omit<LessonSummary, 'microDecisionCorrectOption' | 'blocks'> {
  // Sem gabarito nem explicação das perguntas intermediárias (`toPublicBlocks`).
  blocks: PublicLessonBlocks | null
  checkpoints: CheckpointState[]
  // Quantas perguntas intermediárias o aluno acertou de primeira nesta lição.
  checkpointsFirstTry: number
  status: LessonStatus
  currentStep: number
  // Estado da pergunta (RC.2.3), pra o player restaurar a tela depois de sair
  // e voltar: o gabarito nunca vai aqui, só o que o próprio usuário já tentou.
  microDecisionSolved: boolean
  microDecisionWrongOptions: number[]
  // Lição dispensada e ainda não feita (N.24): aparece no mapa como "nova,
  // opcional" — disponível pra fazer, mas sem bloquear nada.
  waived: boolean
}

function sequenceStateFor(
  record: CheckpointRecord,
): { sequence: number[] } | Record<string, never> {
  return record.solvedAt !== null && record.lastResponse?.kind === 'order'
    ? { sequence: record.lastResponse.sequence }
    : {}
}

function estimateStateFor(
  lesson: LessonSummary,
  record: CheckpointRecord,
): { estimate: EstimateResult } | Record<string, never> {
  const block = findCheckBlock(lesson.blocks, record.checkpointId)
  if (
    record.lastResponse?.kind !== 'estimate' ||
    record.solvedAt === null ||
    block?.kind !== 'estimate'
  ) {
    return {}
  }
  return {
    estimate: {
      guess: record.lastResponse.value,
      ...classifyEstimate(block, record.lastResponse.value),
    },
  }
}

export function buildLessonView(
  lesson: LessonSummary,
  progress: LessonProgressSnapshot | undefined,
  progression: Progression,
  checkpointRecords: CheckpointRecord[] = [],
): LessonView {
  const completedByUser = progress?.completedAt != null
  const status = lessonStatus({
    unlocked: progression.isUnlocked(lesson.id),
    completedByUser,
  })

  const checkpoints: CheckpointState[] = checkpointRecords.map((record) => ({
    checkpointId: record.checkpointId,
    solved: record.solvedAt !== null,
    attempts: record.attempts,
    wrongOptions: record.wrongOptions,
    // Estimativa resolve na 1ª resposta mesmo longe do valor: "de primeira" é a que caiu na mosca.
    firstTry:
      record.solvedAt !== null &&
      record.attempts === 1 &&
      (record.lastResponse?.kind === 'estimate' ? record.lastResponse.hit : true),
    ...estimateStateFor(lesson, record),
    ...sequenceStateFor(record),
  }))

  return {
    id: lesson.id,
    code: lesson.code,
    title: lesson.title,
    trackNumber: lesson.trackNumber,
    trackName: lesson.trackName,
    sortOrder: lesson.sortOrder,
    centralConcept: lesson.centralConcept,
    scenarioText: lesson.scenarioText,
    microDecisionPrompt: lesson.microDecisionPrompt,
    microDecisionType: lesson.microDecisionType,
    microDecisionAssetTicker: lesson.microDecisionAssetTicker,
    revelationText: lesson.revelationText,
    unlocksDescription: lesson.unlocksDescription,
    unlocksKeys: lesson.unlocksKeys,
    unlocksAssetTicker: lesson.unlocksAssetTicker,
    microDecisionOptions: lesson.microDecisionOptions,
    blocks: toPublicBlocks(lesson.blocks),
    checkpoints,
    checkpointsFirstTry: checkpoints.filter((c) => c.firstTry).length,
    status,
    currentStep: progress?.currentStep ?? 0,
    microDecisionSolved: progress?.microDecisionSolvedAt != null,
    microDecisionWrongOptions: progress?.microDecisionWrongOptions ?? [],
    waived: !completedByUser && progress?.waivedAt != null,
  }
}

export interface MicroDecisionResult {
  correct: boolean
  correctOptionLabel: string
}

// Devolve o veredito da aposta (correção da revisão da PR 18) só quando
// `selectedOption` de fato veio nesta chamada e a lição tem aposta real —
// consumido por `AdvanceLessonUseCase`, nunca por `buildLessonView` acima
// (`GET /lessons` continua sem o índice certo). Reaproveita `isCorrectOption`
// pra não duplicar a regra dos 3 estados.
export function microDecisionResultFor(
  lesson: Pick<LessonSummary, 'microDecisionOptions' | 'microDecisionCorrectOption'>,
  selectedOption: number | undefined,
): MicroDecisionResult | undefined {
  if (selectedOption === undefined) {
    return undefined
  }
  const correct = isCorrectOption(lesson, selectedOption)
  if (correct === null || lesson.microDecisionCorrectOption === null) {
    return undefined
  }
  return {
    correct,
    correctOptionLabel: lesson.microDecisionOptions?.[lesson.microDecisionCorrectOption] ?? '',
  }
}

// Desbloqueio real de funcionalidade/produto por lição (tarefa 7.0.1,
// achado 5 do backlog Semana 7): diferente de `isUnlocked` acima (que só
// decide se a lição em si está disponível pra fazer), esta função decide
// quais chaves ('portfolio', 'asset:acao', ...) já viraram acesso de
// verdade. Critério deliberadamente mais estrito — posição <=
// satisfiedCount, não satisfiedCount + 1 — porque a chave só deve valer
// depois que a lição foi de fato *satisfeita* (ex: entender Tesouro Selic
// antes de poder comprá-lo), enquanto `isUnlocked` só decide se dá pra
// começar. Lição dispensada (N.24) conta como satisfeita: quem já passou
// daquele ponto provavelmente já viu o conteúdo, então mantém o produto.
// Nunca "tranca de novo" depois de desbloqueado (união, não diferença).
// `lessons` são as publicadas, em qualquer ordem. Espelhada em TS puro no
// frontend (`frontend/src/features/lessons/unlockedKeys`) a partir dos
// mesmos dados de `GET /lessons` — sem endpoint novo.
export function unlockedKeysFor(
  satisfiedCount: number,
  lessons: Pick<LessonSummary, 'sortOrder' | 'unlocksKeys' | 'trackNumber'>[],
): Set<string> {
  const keys = new Set<string>()
  const ordered = lessons
    .filter((lesson) => !isParallelTrack(lesson.trackNumber))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  for (const lesson of ordered.slice(0, satisfiedCount)) {
    for (const key of lesson.unlocksKeys) {
      keys.add(key)
    }
  }
  return keys
}

// Único lugar que define "lição concluída" (completedAt preenchido) —
// reaproveitado por `CountCompletedLessonsUseCase` (achievements, XP,
// missões). Conta só conclusão real: a dispensa (N.24) entra em
// `isSatisfied`/`buildProgression`, nunca aqui.
export function countCompleted(progress: Pick<LessonProgressSnapshot, 'completedAt'>[]): number {
  return progress.filter((p) => p.completedAt !== null).length
}

// Missão "revise uma lição antiga" (backlog engajamento H.2) — só conta
// lição concluída há pelo menos esse tanto de dias, pra distinguir revisão
// real de simplesmente reabrir algo recém-concluído no mesmo dia.
export const REVIEW_ELIGIBLE_AFTER_DAYS = 14

export function isEligibleForReview(completedAt: Date, now: Date): boolean {
  const msPerDay = 24 * 60 * 60 * 1000
  return now.getTime() - completedAt.getTime() >= REVIEW_ELIGIBLE_AFTER_DAYS * msPerDay
}

// Sequência de acertos seguidos na Micro-decisão (backlog engajamento H.1,
// critério `micro_decisions_streak`; reaproveitada pela H.3 filtrando os
// attempts pelo dia corrente antes de chamar esta função — a "mesma
// consulta" citada no texto da tarefa é esta, não um 2º cálculo). Entrada já
// vem só com attempts de lição com aposta real (`correct` nunca `null`,
// filtro fica em `GetCurrentMicroDecisionStreakUseCase`), em ordem
// cronológica ascendente — lições sem aposta real (checkbox) não entram na
// lista e por isso nem quebram nem contam a sequência.
export interface MicroDecisionAttempt {
  completedAt: Date
  correct: boolean
}

export function currentMicroDecisionStreak(attemptsChronological: MicroDecisionAttempt[]): number {
  let streak = 0
  for (let i = attemptsChronological.length - 1; i >= 0; i--) {
    if (!attemptsChronological[i].correct) {
      break
    }
    streak++
  }
  return streak
}

// Junta lição (índice certo) com progresso (índice escolhido + `completedAt`)
// pra montar a entrada de `currentMicroDecisionStreak` — extraído de dentro
// de `GetCurrentMicroDecisionStreakUseCase` (H.1) pra ser reaproveitado
// também por `HasMicroDecisionStreakTodayUseCase` (H.3, que filtra o
// resultado pelo dia corrente antes de chamar `currentMicroDecisionStreak`
// de novo — a "mesma consulta" citada no texto da tarefa). Descarta lições
// sem aposta real ou sem `completedAt`, mesmo critério dos 2 consumidores.
export function buildMicroDecisionAttemptsChronological(
  lessons: Pick<LessonSummary, 'id' | 'microDecisionCorrectOption'>[],
  progress: {
    lessonId: string
    completedAt: Date | null
    microDecisionSelectedOption: number | null
  }[],
): MicroDecisionAttempt[] {
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]))

  const attempts = progress.flatMap((p) => {
    const lesson = lessonById.get(p.lessonId)
    if (!lesson || p.completedAt === null) {
      return []
    }
    const correct = isCorrectOption(lesson, p.microDecisionSelectedOption)
    if (correct === null) {
      return []
    }
    return [{ completedAt: p.completedAt, correct }]
  })

  return attempts.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
}

// Missão diária "acerte 3 apostas seguidas hoje" (backlog engajamento H.3) —
// limiar fixo, sem coluna própria em `daily_missions` (nenhuma outra missão
// desta fase precisa de um alvo numérico configurável).
export const MICRO_DECISION_MISSION_STREAK_THRESHOLD = 3

// Compartilhado por `tracksCompletedWithoutErrors` e `completedTrackNumbers`
// abaixo (achado da revisão da PR 19: as duas reimplementavam o mesmo
// acumulador AND-por-trilha) — devolve os números das trilhas em que toda
// lição satisfaz `predicate`, ordenados. Trilha sem nenhuma lição na entrada
// nunca aparece (não existe "trilha vazia" completa/sem erro).
function trackNumbersWhereEveryLessonSatisfies<T extends { trackNumber: number }>(
  lessons: T[],
  predicate: (lesson: T) => boolean,
): number[] {
  const okSoFarByTrack = new Map<number, boolean>()
  for (const lesson of lessons) {
    const soFar = okSoFarByTrack.get(lesson.trackNumber) ?? true
    okSoFarByTrack.set(lesson.trackNumber, soFar && predicate(lesson))
  }

  return [...okSoFarByTrack.entries()]
    .filter(([, ok]) => ok)
    .map(([trackNumber]) => trackNumber)
    .sort((a, b) => a - b)
}

// Trilhas concluídas sem nenhum erro na aposta (backlog engajamento H.1,
// critério `track_completed_no_errors`) — mesma regra de "trilha completa"
// de `completedTrackNumbers` abaixo, com uma condição a mais: nenhuma lição
// da trilha pode ter `isCorrectOption` diferente de `true` quando ela tem
// aposta real. Lição sem aposta real (`microDecisionCorrectOption === null`)
// nunca conta como erro, mesmo critério de `currentMicroDecisionStreak` — mas
// lição *com* aposta real concluída sem `microDecisionSelectedOption` (a API
// não exige a escolha pra concluir, só o frontend) também não conta como
// "sem erro": `isCorrectOption` devolve `null` nesse caso (não é `false`),
// então checar só `=== false` deixaria passar como impecável uma trilha em
// que o usuário nunca de fato apostou (achado da revisão da PR 19).
export function tracksCompletedWithoutErrors(
  lessons: {
    trackNumber: number
    completedAt: Date | null
    waivedAt: Date | null
    microDecisionCorrectOption: number | null
    microDecisionSelectedOption: number | null
  }[],
): number[] {
  return trackNumbersWhereEveryLessonSatisfies(lessons, (lesson) => {
    // Lição dispensada nunca foi apostada, então não há erro a contar contra
    // a trilha (N.24); só a que foi feita com aposta real precisa ter acertado.
    if (lesson.completedAt === null) {
      return lesson.waivedAt !== null
    }
    const hasRealBet = lesson.microDecisionCorrectOption !== null
    const wonBet = isCorrectOption(lesson, lesson.microDecisionSelectedOption) === true
    return !hasRealBet || wonBet
  })
}

// Lições distintas já revisadas voluntariamente pelo menos uma vez (backlog
// engajamento H.1, critério `lesson_reviewed`). `lastReviewedAt` (H.2) é
// sobrescrito a cada nova revisão da mesma lição, não acumulado — por isso
// o número aqui é "quantas lições diferentes já foram revisadas", não
// "quantas vezes no total", que a coluna atual não sustenta.
export function countReviewedLessons(progress: { lastReviewedAt: Date | null }[]): number {
  return progress.filter((p) => p.lastReviewedAt !== null).length
}

// Trilha "completa" (backlog de engajamento F.2, sala de troféus do Perfil):
// todas as lições dela satisfeitas (concluídas ou dispensadas, N.24 — assim
// um troféu já conquistado não regride quando uma lição nova entra no meio da
// trilha de quem já passou dela). Uma trilha sem nenhuma lição na lista de
// entrada nunca aparece no resultado (não existe "trilha completa vazia").
export function completedTrackNumbers(
  lessons: { trackNumber: number; completedAt: Date | null; waivedAt: Date | null }[],
): number[] {
  return trackNumbersWhereEveryLessonSatisfies(lessons, isSatisfied)
}
