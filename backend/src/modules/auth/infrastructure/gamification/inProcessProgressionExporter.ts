import type { GetProgressionUseCase } from '../../../gamification/application/useCases/getProgression'
import type { ProgressionExporter } from '../../application/ports/progressionExporter'

export function createInProcessProgressionExporter(
  getProgression: GetProgressionUseCase,
): ProgressionExporter {
  return {
    async exportForUser(userId) {
      const progression = await getProgression.execute({ userId })
      return {
        xp: progression.xp,
        level: progression.level,
        currentStreak: progression.currentStreak,
        longestStreak: progression.longestStreak,
        lastQualifyingActivityDate: progression.lastQualifyingActivityDate,
      }
    },
  }
}
