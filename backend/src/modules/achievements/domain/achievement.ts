export type AchievementCriteriaType =
  | 'net_worth'
  | 'streak_days'
  | 'lessons_completed'
  | 'trades_executed'
  // Critérios de qualidade (backlog engajamento H.1), não só volume — todos
  // agregados de `lessons`, ver comentário de `ProgressSnapshot` abaixo.
  | 'micro_decisions_streak'
  | 'track_completed_no_errors'
  | 'lesson_reviewed'

export interface Achievement {
  id: string
  name: string
  description: string | null
  criteriaType: AchievementCriteriaType
  criteriaValue: number
}

// Os números que qualquer critério de conquista pode consultar — agregado em
// processo a partir de `gamification` (5.3), `lessons` (5.6, e os 3 campos
// de qualidade da H.1) e `ranking` (5.5), nunca calculado aqui (ver
// `application/ports/progressSnapshotReader.ts`).
export interface ProgressSnapshot {
  netWorth: number
  streakDays: number
  lessonsCompleted: number
  tradesExecuted: number
  microDecisionsStreak: number
  tracksCompletedNoErrors: number
  lessonsReviewed: number
}

export function progressValueFor(
  criteriaType: AchievementCriteriaType,
  snapshot: ProgressSnapshot,
): number {
  switch (criteriaType) {
    case 'net_worth':
      return snapshot.netWorth
    case 'streak_days':
      return snapshot.streakDays
    case 'lessons_completed':
      return snapshot.lessonsCompleted
    case 'trades_executed':
      return snapshot.tradesExecuted
    case 'micro_decisions_streak':
      return snapshot.microDecisionsStreak
    case 'track_completed_no_errors':
      return snapshot.tracksCompletedNoErrors
    case 'lesson_reviewed':
      return snapshot.lessonsReviewed
  }
}

export function isSatisfied(
  criteriaType: AchievementCriteriaType,
  criteriaValue: number,
  snapshot: ProgressSnapshot,
): boolean {
  return progressValueFor(criteriaType, snapshot) >= criteriaValue
}

export interface AchievementView extends Achievement {
  unlocked: boolean
  unlockedAt: Date | null
  // Valor atual do usuário pro critério desta conquista — mesmo desbloqueada,
  // pra tela 7.2 mostrar "streak 3/7 dias" nas bloqueadas.
  progress: number
}

export function buildAchievementView(
  achievement: Achievement,
  unlockedAt: Date | null,
  snapshot: ProgressSnapshot,
): AchievementView {
  return {
    ...achievement,
    unlocked: unlockedAt !== null,
    unlockedAt,
    progress: progressValueFor(achievement.criteriaType, snapshot),
  }
}
