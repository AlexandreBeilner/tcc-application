import type { MicroDecisionStreakChecker } from '../../application/ports/microDecisionStreakChecker'

export function createFakeMicroDecisionStreakChecker(
  hasStreak = false,
): MicroDecisionStreakChecker {
  return {
    async hasMicroDecisionStreakToday() {
      return hasStreak
    },
  }
}
