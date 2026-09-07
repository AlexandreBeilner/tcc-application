import type { UnlockedAchievement } from './xpAwarder'

export interface StreakTouchResult {
  currentStreak: number
  longestStreak: number
  // Marco de streak (7 ou 30 dias) cruzado exatamente por este toque —
  // `null` em qualquer outro dia. Ver `gamification/domain/streak.ts`.
  milestoneReached: number | null
  unlockedAchievements: UnlockedAchievement[]
}

// Port própria e mínima sobre `modules/gamification` (5.3) — conclusão de
// **qualquer** missão mantém o streak, consistente com a decisão da 5.3
// (não exige todas as missões do dia). Devolve o resultado real (tarefa
// I.2), mesmo motivo de `xpAwarder.ts`.
export interface StreakTracker {
  touch(userId: string): Promise<StreakTouchResult>
}
