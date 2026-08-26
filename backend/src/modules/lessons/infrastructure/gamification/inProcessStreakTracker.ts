import type { TouchStreakUseCase } from '../../../gamification/application/useCases/touchStreak'
import type { StreakTracker } from '../../application/ports/streakTracker'

// Adapter fino em processo sobre `TouchStreakUseCase` (5.3) — ver
// `streakTracker.ts`.
export function createInProcessStreakTracker(touchStreak: TouchStreakUseCase): StreakTracker {
  return {
    async touch(userId) {
      await touchStreak.execute({ userId })
    },
  }
}
