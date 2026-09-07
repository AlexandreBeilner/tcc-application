// Recém-desbloqueada nesta chamada — subconjunto mínimo de `Achievement`
// (`modules/achievements/domain/achievement.ts`), duplicado aqui de
// propósito em vez de importado (application/ não importa outro módulo
// direto — mesma decisão de `profile/application/ports/achievementsReader.ts`,
// que já duplica um recorte parecido pro mesmo tipo real).
export interface UnlockedAchievement {
  id: string
  name: string
  description: string | null
}

// Port própria e mínima sobre `modules/achievements` (5.2) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `CheckAndUnlockAchievementsUseCase` (mesma direção de composição de
// `xpAwarder`/`streakTracker`, só que aqui é `gamification` quem consome:
// AwardXpUseCase/TouchStreakUseCase chamam isto depois de escrever, porque
// qualquer crédito de xp ou toque de streak pode satisfazer um critério de
// conquista). Devolve as recém-desbloqueadas nesta chamada (tarefa I.2 do
// backlog de engajamento — antes descartado como `Promise<void>`, sem dado
// nenhum pro "teatro de recompensa" da I.1 consumir).
export interface AchievementChecker {
  checkAndUnlock(userId: string): Promise<UnlockedAchievement[]>
}
