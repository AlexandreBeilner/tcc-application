import { buildAchievementView, type AchievementView } from '../../domain/achievement'
import type { AchievementRepository } from '../ports/achievementRepository'
import type { ProgressSnapshotReader } from '../ports/progressSnapshotReader'

export interface ListAchievementsInput {
  userId: string
}

export class ListAchievementsUseCase {
  constructor(
    private readonly achievementRepository: AchievementRepository,
    private readonly progressSnapshotReader: ProgressSnapshotReader,
  ) {}

  async execute(input: ListAchievementsInput): Promise<AchievementView[]> {
    const [catalog, unlocked, snapshot] = await Promise.all([
      this.achievementRepository.listCatalog(),
      this.achievementRepository.listUnlockedForUser(input.userId),
      this.progressSnapshotReader.getSnapshot(input.userId),
    ])
    const unlockedAtByAchievementId = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]))

    return catalog.map((achievement) =>
      buildAchievementView(
        achievement,
        unlockedAtByAchievementId.get(achievement.id) ?? null,
        snapshot,
      ),
    )
  }
}
