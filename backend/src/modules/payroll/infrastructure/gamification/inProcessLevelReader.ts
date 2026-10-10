import type { GetProgressionUseCase } from '../../../gamification/application/useCases/getProgression'
import type { LevelReader } from '../../application/ports/levelReader'

export function createInProcessLevelReader(getProgression: GetProgressionUseCase): LevelReader {
  return {
    async getLevel(userId) {
      const progression = await getProgression.execute({ userId })
      return progression.level
    },
  }
}
