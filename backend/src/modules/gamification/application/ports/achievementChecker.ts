// Port própria e mínima sobre `modules/achievements` (5.2) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `CheckAndUnlockAchievementsUseCase` (mesma direção de composição de
// `xpAwarder`/`streakTracker`, só que aqui é `gamification` quem consome:
// AwardXpUseCase/TouchStreakUseCase chamam isto depois de escrever, porque
// qualquer crédito de xp ou toque de streak pode satisfazer um critério de
// conquista).
export interface AchievementChecker {
  checkAndUnlock(userId: string): Promise<void>
}
