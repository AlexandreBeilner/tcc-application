// Espelha `.docs/backend/missions.md` (`GET /missions`) — `status` já vem
// calculado por usuário e por dia (UTC), gerado sob demanda no primeiro
// `GET` do dia.
export interface DailyMission {
    id: string
    // Slug estável (ex: 'feed_read', tarefa 6.6.4) — usar pra achar uma
    // missão específica no catálogo, nunca `title` (texto livre, pode
    // mudar).
    key: string
    title: string
    description: string
    completionCriteria: string
    xpReward: number
    requiresLessonCompletion: boolean
    status: 'pending' | 'completed'
}

export interface ListMissionsResult {
    missions: DailyMission[]
}

// Recém-desbloqueada nesta chamada (`.docs/backend/missions.md`).
export interface UnlockedAchievement {
    id: string
    name: string
    description: string | null
}

// `POST /missions/:id/complete` — idempotente, reenviar depois de já
// concluída no dia só confirma o status, não credita xp/streak de novo (a
// resposta idempotente vem só com `status`, sem os 4 campos abaixo).
export interface CompleteMissionResult {
    status: 'completed'
    // Presentes só na chamada que credita xp de fato (backlog engajamento
    // I.2). `xpAwarded`/`leveledUp` consumidos pelo reveal de XP/nível (I.3,
    // `features/shell/xpRewardReveal`); `streakMilestone`/
    // `unlockedAchievements` ainda sem consumidor (I.4/I.5).
    xpAwarded?: number
    leveledUp?: boolean
    streakMilestone?: number | null
    unlockedAchievements?: UnlockedAchievement[]
}
