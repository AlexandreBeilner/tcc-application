// Dia calendário em UTC, formato YYYY-MM-DD — reexportado daqui (usado pra
// comparar a data de `completedAt`, missões 5.4 precisam saber "concluiu uma
// lição hoje") pra manter o import existente em `application/`; implementação
// real em `shared/utcDate.ts`, compartilhada com `gamification`/`missions`.
export { utcDateString } from '../../../shared/utcDate'

export const LESSON_UNLOCK_STEP = 3

// Ilustrativo, sujeito à calibração da tarefa 8.1 — mesmo tratamento dado às
// demais constantes de gamificação (curva de xp da 5.1, recompensa de
// missão da 5.4). Lições concedem uma recompensa flat, ao contrário de
// `daily_missions` (que tem `xp_reward` por linha) — o currículo não
// distingue "peso" pedagógico entre lições nesta fase.
export const LESSON_XP_REWARD = 50

export type LessonStatus = 'completed' | 'available' | 'locked'

// Widget do passo Micro-decisão (spec 5.2, tarefa 7.0.2) — espelha o enum
// `lesson_micro_decision_type` do schema. 'reflection' é o padrão (checkbox
// "já pensei"); os outros embutem um componente já existente (tarefa 6.7)
// no frontend em vez do checkbox.
export type MicroDecisionType =
  'reflection' | 'growth_calculator' | 'fixed_income_comparison' | 'live_indicator'

// Progressão essencialmente linear por sortOrder global (spec 5.1) — cada
// trilha só desbloqueia a próxima na última lição, sem pré-requisito
// ramificado/paralelo modelado (decisão de escopo, ver backlog tarefa 5.6).
export function isUnlocked(sortOrder: number, completedCount: number): boolean {
  return sortOrder <= completedCount + 1
}

export function lessonStatus(input: {
  sortOrder: number
  completedCount: number
  completedByUser: boolean
}): LessonStatus {
  if (input.completedByUser) {
    return 'completed'
  }
  return isUnlocked(input.sortOrder, input.completedCount) ? 'available' : 'locked'
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
  // campos é o estado normal de hoje (checkbox "já pensei" no passo
  // Micro-decisão); só uma lição com as duas colunas preenchidas (autoria é
  // a B.4) troca pro widget de escolha real (B.3).
  microDecisionOptions: string[] | null
  microDecisionCorrectOption: number | null
}

export interface LessonProgressSnapshot {
  currentStep: number
  completedAt: Date | null
  // Índice escolhido pelo usuário na Micro-decisão (B.1) — `null` até a
  // escolha ser gravada (B.2) ou pra lição sem aposta real.
  microDecisionSelectedOption: number | null
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
export interface LessonView extends Omit<LessonSummary, 'microDecisionCorrectOption'> {
  status: LessonStatus
  currentStep: number
}

export function buildLessonView(
  lesson: LessonSummary,
  progress: LessonProgressSnapshot | undefined,
  completedCount: number,
): LessonView {
  const status = lessonStatus({
    sortOrder: lesson.sortOrder,
    completedCount,
    completedByUser: progress?.completedAt != null,
  })

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
    status,
    currentStep: progress?.currentStep ?? 0,
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
// verdade. Critério deliberadamente mais estrito — sortOrder <=
// completedCount, não completedCount + 1 — porque a chave só deve valer
// depois que a lição foi de fato *concluída* (ex: entender Tesouro Selic
// antes de poder comprá-lo), enquanto `isUnlocked` só decide se dá pra
// começar. Nunca "tranca de novo" depois de desbloqueado (união, não
// diferença). Espelhada em TS puro no frontend
// (`frontend/src/features/lessons/unlockedKeys.ts`) a partir dos mesmos
// dados de `GET /lessons` — sem endpoint novo.
export function unlockedKeysFor(
  completedCount: number,
  lessons: Pick<LessonSummary, 'sortOrder' | 'unlocksKeys'>[],
): Set<string> {
  const keys = new Set<string>()
  for (const lesson of lessons) {
    if (lesson.sortOrder <= completedCount) {
      for (const key of lesson.unlocksKeys) {
        keys.add(key)
      }
    }
  }
  return keys
}

// Único lugar que define "lição concluída" (completedAt preenchido) —
// reaproveitado por `CountCompletedLessonsUseCase` (achievements) e
// `GetUnlockedProductKeysUseCase` (gate de desbloqueio real, tarefa
// 7.0.1) pra evitar que os dois critérios divirjam silenciosamente.
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

// Trilhas concluídas sem nenhum erro na aposta (backlog engajamento H.1,
// critério `track_completed_no_errors`) — mesma regra de "trilha completa"
// de `completedTrackNumbers` acima, com uma condição a mais: nenhuma lição
// da trilha pode ter `isCorrectOption` `false`. Lição sem aposta real
// (`microDecisionCorrectOption === null`) nunca conta como erro, mesmo
// critério de `currentMicroDecisionStreak`.
export function tracksCompletedWithoutErrors(
  lessons: {
    trackNumber: number
    completedAt: Date | null
    microDecisionCorrectOption: number | null
    microDecisionSelectedOption: number | null
  }[],
): number[] {
  const okSoFarByTrack = new Map<number, boolean>()
  for (const lesson of lessons) {
    const completed = lesson.completedAt !== null
    const hadError = isCorrectOption(lesson, lesson.microDecisionSelectedOption) === false
    const soFar = okSoFarByTrack.get(lesson.trackNumber) ?? true
    okSoFarByTrack.set(lesson.trackNumber, soFar && completed && !hadError)
  }

  return [...okSoFarByTrack.entries()]
    .filter(([, ok]) => ok)
    .map(([trackNumber]) => trackNumber)
    .sort((a, b) => a - b)
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
// todas as lições dela concluídas, mesmo critério de `completedAt !== null`
// usado por `countCompleted` acima. Uma trilha sem nenhuma lição na lista de
// entrada nunca aparece no resultado (não existe "trilha completa vazia").
export function completedTrackNumbers(
  lessons: { trackNumber: number; completedAt: Date | null }[],
): number[] {
  const allCompletedByTrack = new Map<number, boolean>()
  for (const lesson of lessons) {
    const completed = lesson.completedAt !== null
    const soFar = allCompletedByTrack.get(lesson.trackNumber) ?? true
    allCompletedByTrack.set(lesson.trackNumber, soFar && completed)
  }

  return [...allCompletedByTrack.entries()]
    .filter(([, allCompleted]) => allCompleted)
    .map(([trackNumber]) => trackNumber)
    .sort((a, b) => a - b)
}
