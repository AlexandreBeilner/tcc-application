import type { LevelReader } from '../../application/ports/levelReader'

export function createFakeLevelReader(
  progressionByUserId: Record<string, { level: number; xp: number }> = {},
): LevelReader {
  return {
    async getProgression(userId) {
      return progressionByUserId[userId] ?? { level: 1, xp: 0 }
    },
  }
}
