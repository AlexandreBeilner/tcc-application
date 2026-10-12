import type { AchievementMailer } from '../../application/ports/achievementMailer'
import type { Achievement } from '../../domain/achievement'

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
