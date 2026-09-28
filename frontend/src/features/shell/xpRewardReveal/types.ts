// Recorte mínimo de `AdvanceLessonResult`/`CompleteMissionResult`
// (`.docs/backend/lessons.md`/`missions.md`) que este módulo precisa —
// os dois campos que a I.2 acrescentou de que a I.3 depende.
export interface XpRewardSource {
    xpAwarded?: number
    leveledUp?: boolean
    // Nível após o crédito (tarefa T.10) — presente sempre que `leveledUp`
    // é, usado pra calcular o salário mensal novo no reveal de level-up.
    newLevel?: number
}
