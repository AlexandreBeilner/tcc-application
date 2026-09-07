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
}

export interface LessonProgressSnapshot {
  currentStep: number
  completedAt: Date | null
}

export interface LessonView extends LessonSummary {
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

  return { ...lesson, status, currentStep: progress?.currentStep ?? 0 }
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

// Dia calendário em UTC, formato YYYY-MM-DD — mesma convenção de
// `gamification/domain/streak.ts` (5.3), usada aqui só pra comparar a data
// de `completedAt` (missões, 5.4, precisam saber "concluiu uma lição hoje").
export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Missão "revise uma lição antiga" (backlog engajamento H.2) — só conta
// lição concluída há pelo menos esse tanto de dias, pra distinguir revisão
// real de simplesmente reabrir algo recém-concluído no mesmo dia.
export const REVIEW_ELIGIBLE_AFTER_DAYS = 14

export function isEligibleForReview(completedAt: Date, now: Date): boolean {
  const msPerDay = 24 * 60 * 60 * 1000
  return now.getTime() - completedAt.getTime() >= REVIEW_ELIGIBLE_AFTER_DAYS * msPerDay
}
