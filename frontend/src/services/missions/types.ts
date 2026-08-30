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

// `POST /missions/:id/complete` — idempotente, reenviar depois de já
// concluída no dia só confirma o status, não credita xp/streak de novo.
export interface CompleteMissionResult {
    status: 'completed'
}
