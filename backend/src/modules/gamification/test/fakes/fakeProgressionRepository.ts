import type { ProgressionRepository } from '../../application/ports/progressionRepository'
import type { Progression } from '../../domain/progression'

export function createFakeProgressionRepository(): ProgressionRepository {
  const byUserId = new Map<string, Progression>()

  return {
    async findByUserId(userId) {
      return byUserId.get(userId)
    },

    async upsert(progression) {
      byUserId.set(progression.userId, progression)
      return progression
    },
  }
}
