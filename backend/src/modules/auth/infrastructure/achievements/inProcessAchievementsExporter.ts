import type { ExportUnlockedAchievementsUseCase } from '../../../achievements/application/useCases/exportUnlockedAchievements'
import type { AchievementsExporter } from '../../application/ports/achievementsExporter'

export function createInProcessAchievementsExporter(
  exportUnlockedAchievements: ExportUnlockedAchievementsUseCase,
): AchievementsExporter {
  return {
    async exportForUser(userId) {
      return exportUnlockedAchievements.execute({ userId })
    },
  }
}
