import type { GetProgressionUseCase } from '../../../gamification/application/useCases/getProgression'
import type { GamificationReader } from '../../application/ports/gamificationReader'

export function createInProcessGamificationReader(
  getProgression: GetProgressionUseCase,
): GamificationReader {
  return {
    async getSummary(userId) {
      const progression = await getProgression.execute({ userId })
      return {
        level: progression.level,
        xp: progression.xp,
        currentStreak: progression.currentStreak,
      }
    },
  }
}
