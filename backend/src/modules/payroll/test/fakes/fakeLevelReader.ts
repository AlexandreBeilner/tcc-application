import type { LevelReader } from '../../application/ports/levelReader'

export function createFakeLevelReader(levelByUserId: Record<string, number> = {}): LevelReader {
  return {
    async getLevel(userId) {
      return levelByUserId[userId] ?? 1
    },
  }
}
