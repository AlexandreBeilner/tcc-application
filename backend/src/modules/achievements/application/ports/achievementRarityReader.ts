import type { AchievementRarity } from '../../domain/rarity'

export interface AchievementRarityReader {
  getRarity(achievementId: string): Promise<AchievementRarity>
}
