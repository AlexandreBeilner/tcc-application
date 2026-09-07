import type { TouchStreakUseCase } from '../../../gamification/application/useCases/touchStreak'
import type { StreakTracker } from '../../application/ports/streakTracker'

// Adapter fino em processo sobre `TouchStreakUseCase` (5.3) — ver
// `streakTracker.ts`.
export function createInProcessStreakTracker(touchStreak: TouchStreakUseCase): StreakTracker {
  return {
    async touch(userId) {
      const result = await touchStreak.execute({ userId })
      return {
        currentStreak: result.currentStreak,
        longestStreak: result.longestStreak,
        milestoneReached: result.milestoneReached,
        unlockedAchievements: result.unlockedAchievements,
      }
    },
  }
}
