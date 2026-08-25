import type { LevelReader } from '../../application/ports/levelReader'

export function createFakeLevelReader(levelsByUserId: Record<string, number> = {}): LevelReader {
  return {
    async getLevel(userId) {
      return levelsByUserId[userId] ?? 1
    },
  }
}
