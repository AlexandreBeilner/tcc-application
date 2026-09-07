import type { UnlockedAchievement } from './xpAwarder'

export interface StreakTouchResult {
  currentStreak: number
  longestStreak: number
  // Marco de streak (7 ou 30 dias) cruzado exatamente por este toque —
  // `null` em qualquer outro dia. Ver `gamification/domain/streak.ts`.
  milestoneReached: number | null
  unlockedAchievements: UnlockedAchievement[]
}

// Port própria e mínima sobre `modules/gamification` (5.3) — implementada,
// na composição (app.ts), por um adapter em processo sobre
// `TouchStreakUseCase`. Ver `xpAwarder.ts` (mesma decisão de composição e o
// mesmo motivo pra devolver o resultado real — tarefa I.2).
export interface StreakTracker {
  touch(userId: string): Promise<StreakTouchResult>
}
