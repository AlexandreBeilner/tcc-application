import type { FindLessonUnlockingKeyUseCase } from '../../../lessons/application/useCases/findLessonUnlockingKey'
import type { GetUnlockedProductKeysUseCase } from '../../../lessons/application/useCases/getUnlockedProductKeys'
import type { ProductUnlockReader } from '../../application/ports/productUnlockReader'

export function createInProcessProductUnlockReader(
  getUnlockedProductKeys: GetUnlockedProductKeysUseCase,
  findLessonUnlockingKey: FindLessonUnlockingKeyUseCase,
): ProductUnlockReader {
  return {
    getUnlockedKeys(userId) {
      return getUnlockedProductKeys.execute({ userId })
    },
    findLessonUnlocking(key) {
      return findLessonUnlockingKey.execute({ key })
    },
  }
}
