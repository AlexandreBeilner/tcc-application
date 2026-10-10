import type { AchievementMailer } from '../../application/ports/achievementMailer'
import type { AchievementRarityReader } from '../../application/ports/achievementRarityReader'
import type { Achievement } from '../../domain/achievement'
import type { AchievementRarity } from '../../domain/rarity'

// Nada é raro por padrão: os testes que não falam de e-mail não disparam aviso nenhum.
export function createFakeRarityReader(
  rarityById: Record<string, AchievementRarity> = {},
): AchievementRarityReader {
  return {
    async getRarity(achievementId) {
      return rarityById[achievementId] ?? { holders: 50, population: 100 }
    },
  }
}

export function createFakeAchievementMailer(): AchievementMailer & {
  sent: Array<{ userId: string; achievement: Achievement }>
} {
  const sent: Array<{ userId: string; achievement: Achievement }> = []
  return {
    sent,
    async sendRareUnlocked(input) {
      sent.push(input)
    },
  }
}
