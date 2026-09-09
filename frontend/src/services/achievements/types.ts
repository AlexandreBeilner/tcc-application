// Espelha `.docs/backend/achievements.md` (`GET /achievements`).
export type AchievementCriteriaType =
    | 'net_worth'
    | 'streak_days'
    | 'lessons_completed'
    | 'trades_executed'
    | 'micro_decisions_streak'
    | 'track_completed_no_errors'
    | 'lesson_reviewed'

export interface Achievement {
    id: string
    name: string
    description: string
    criteriaType: AchievementCriteriaType
    criteriaValue: number
    unlocked: boolean
    unlockedAt: string | null
    // Valor atual do usuário pro critério — presente mesmo bloqueada,
    // sustenta "streak 3/7 dias" (tela 7.2) sem cálculo extra no frontend.
    progress: number
}

export interface ListAchievementsResult {
    achievements: Achievement[]
}
