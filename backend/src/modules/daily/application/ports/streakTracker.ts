import type { UnlockedAchievement } from './xpAwarder'

export interface StreakTouchResult {
  currentStreak: number
  longestStreak: number
  // Marco de streak (7 ou 30 dias) cruzado exatamente por este toque.
  milestoneReached: number | null
  unlockedAchievements: UnlockedAchievement[]
}

// DI4: concluir o Diário do dia conta como atividade do dia para o streak principal.
export interface StreakTracker {
  touch(userId: string): Promise<StreakTouchResult>
}
