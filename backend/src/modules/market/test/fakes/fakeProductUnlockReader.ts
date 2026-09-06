import type { LessonUnlockHint, ProductUnlockReader } from '../../application/ports/productUnlockReader'

export interface FakeProductUnlockReader extends ProductUnlockReader {
  getUnlockedKeysCalls: string[]
  findLessonUnlockingCalls: string[]
}

export function createFakeProductUnlockReader(config: {
  unlockedKeys?: Set<string>
  lessonHint?: LessonUnlockHint
}): FakeProductUnlockReader {
  const fake: FakeProductUnlockReader = {
    getUnlockedKeysCalls: [],
    findLessonUnlockingCalls: [],
    async getUnlockedKeys(userId) {
      fake.getUnlockedKeysCalls.push(userId)
      return config.unlockedKeys ?? new Set()
    },
    async findLessonUnlocking(key) {
      fake.findLessonUnlockingCalls.push(key)
      return config.lessonHint
    },
  }
  return fake
}
