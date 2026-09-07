// Recorte mínimo de `AdvanceLessonResult`/`CompleteMissionResult`
// (`.docs/backend/lessons.md`/`missions.md`) que este módulo precisa —
// os dois campos que a I.2 acrescentou de que a I.3 depende.
export interface XpRewardSource {
    xpAwarded?: number
    leveledUp?: boolean
}
