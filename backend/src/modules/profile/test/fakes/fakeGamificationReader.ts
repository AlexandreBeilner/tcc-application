import type {
  GamificationReader,
  UserGamificationSummary,
} from '../../application/ports/gamificationReader'

export function createFakeGamificationReader(
  summariesByUserId: Record<string, UserGamificationSummary> = {},
): GamificationReader {
  return {
    async getSummary(userId) {
      return summariesByUserId[userId] ?? { level: 1, xp: 0, currentStreak: 0 }
    },
  }
}
