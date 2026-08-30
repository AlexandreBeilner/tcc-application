import type { GetProgressionUseCase } from '../../../gamification/application/useCases/getProgression'
import type { LevelReader } from '../../application/ports/levelReader'

export function createInProcessLevelReader(getProgression: GetProgressionUseCase): LevelReader {
  return {
    async getProgression(userId) {
      const progression = await getProgression.execute({ userId })
      return { level: progression.level, xp: progression.xp }
    },
  }
}
