import type { AchievementView } from '../../../achievements/domain/achievement'
import type { ListAchievementsUseCase } from '../../../achievements/application/useCases/listAchievements'
import type {
  AchievementsReader,
  UnlockedAchievementSummary,
} from '../../application/ports/achievementsReader'

function isUnlocked(view: AchievementView): view is AchievementView & { unlockedAt: Date } {
  return view.unlocked && view.unlockedAt !== null
}

export function createInProcessAchievementsReader(
  listAchievements: ListAchievementsUseCase,
): AchievementsReader {
  return {
    async listUnlocked(userId): Promise<UnlockedAchievementSummary[]> {
      const views = await listAchievements.execute({ userId })
      return views.filter(isUnlocked).map((view) => ({
        id: view.id,
        name: view.name,
        description: view.description,
        unlockedAt: view.unlockedAt,
      }))
    },
  }
}
