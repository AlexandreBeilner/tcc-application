import type { TouchStreakUseCase } from '../../../gamification/application/useCases/touchStreak'
import type { StreakTracker } from '../../application/ports/streakTracker'

export function createInProcessStreakTracker(touchStreak: TouchStreakUseCase): StreakTracker {
  return {
    async touch(userId) {
      await touchStreak.execute({ userId })
    },
  }
}
