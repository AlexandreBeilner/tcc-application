// Espelha `.docs/backend/missions.md` (`GET /missions`) — `status` já vem
// calculado por usuário e por dia (UTC), gerado sob demanda no primeiro
// `GET` do dia.
export interface DailyMission {
    id: string
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
