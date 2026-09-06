export const LESSON_UNLOCK_STEP = 3

// Ilustrativo, sujeito à calibração da tarefa 8.1 — mesmo tratamento dado às
// demais constantes de gamificação (curva de xp da 5.1, recompensa de
// missão da 5.4). Lições concedem uma recompensa flat, ao contrário de
// `daily_missions` (que tem `xp_reward` por linha) — o currículo não
// distingue "peso" pedagógico entre lições nesta fase.
export const LESSON_XP_REWARD = 50

export type LessonStatus = 'completed' | 'available' | 'locked'

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
  unlocksDescription: string | null
  // Vocabulário fixo (tarefa 7.0.1): 'portfolio', 'calculator', 'news_feed'
  // ou 'asset:<AssetType>'. Ver `unlockedKeysFor` abaixo — normalmente [].
  unlocksKeys: string[]
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

// Dia calendário em UTC, formato YYYY-MM-DD — mesma convenção de
// `gamification/domain/streak.ts` (5.3), usada aqui só pra comparar a data
// de `completedAt` (missões, 5.4, precisam saber "concluiu uma lição hoje").
export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}
