// Recorte mínimo de `UnlockedAchievement`/`AdvanceLessonResult`/
// `CompleteMissionResult` (`.docs/backend/lessons.md`/`missions.md`) que
// este módulo precisa — mesmo formato duplicado independentemente em
// `services/lessons/types.ts` e `services/missions/types.ts` (decisão já
// registrada na I.2, sem import cruzado entre módulos).
export interface UnlockedAchievementSource {
    id: string
    name: string
    description: string | null
}

export interface AchievementRewardSource {
    unlockedAchievements?: UnlockedAchievementSource[]
}
