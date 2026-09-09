import type { HasMicroDecisionStreakTodayUseCase } from '../../../lessons/application/useCases/hasMicroDecisionStreakToday'
import type { MicroDecisionStreakChecker } from '../../application/ports/microDecisionStreakChecker'

export function createInProcessMicroDecisionStreakChecker(
  hasMicroDecisionStreakToday: HasMicroDecisionStreakTodayUseCase,
): MicroDecisionStreakChecker {
  return {
    async hasMicroDecisionStreakToday(userId) {
      return hasMicroDecisionStreakToday.execute({ userId })
    },
  }
}
