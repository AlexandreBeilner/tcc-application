// Recém-desbloqueada nesta chamada — recorte mínimo duplicado do tipo real
// de `modules/achievements` (`Achievement`), mesma decisão de portas
// próprias e independentes por módulo já usada em `xpAwarder`/`streakTracker`
// (ver comentário lá) e em `gamification/application/ports/achievementChecker.ts`.
export interface UnlockedAchievement {
  id: string
  name: string
  description: string | null
}

// Port própria de `lessons` sobre `modules/achievements` (backlog engajamento
// H.1, critério `lesson_reviewed`) — usada só por `ReviewLessonUseCase`.
// Diferente de `xpAwarder`/`streakTracker` (que apontam pra `gamification`,
// que por sua vez consulta `achievements` internamente): revisar uma lição
// nunca credita xp/streak (decisão da H.2), então não existe um evento de
// gamification pra carona — o adapter em processo (`inProcessAchievementChecker.ts`)
// chama `CheckAndUnlockAchievementsUseCase` direto, sem passar por
// `gamification`.
export interface AchievementChecker {
  checkAndUnlock(userId: string): Promise<UnlockedAchievement[]>
}
