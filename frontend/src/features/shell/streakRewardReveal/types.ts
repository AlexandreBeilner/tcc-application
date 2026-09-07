// Recorte mínimo de `AdvanceLessonResult`/`CompleteMissionResult`
// (`.docs/backend/lessons.md`/`missions.md`) que este módulo precisa —
// mesmo padrão de `XpRewardSource` (I.3).
export interface StreakRewardSource {
    streakMilestone?: number | null
}
