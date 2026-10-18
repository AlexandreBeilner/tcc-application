import type { TouchStreakUseCase } from '../../../gamification/application/useCases/touchStreak'
import type { StreakTracker } from '../../application/ports/streakTracker'

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
