import type { XpAwardResult, XpAwarder } from '../../application/ports/xpAwarder'

const DEFAULT_RESULT: XpAwardResult = {
  xp: 0,
  level: 1,
  leveledUp: false,
  unlockedAchievements: [],
}

export interface FakeXpAwarder extends XpAwarder {
  awarded: { userId: string; amount: number; reason: string }[]
  nextResult: XpAwardResult
}

export function createFakeXpAwarder(nextResult: XpAwardResult = DEFAULT_RESULT): FakeXpAwarder {
  const awarded: { userId: string; amount: number; reason: string }[] = []
  const fake: FakeXpAwarder = {
    awarded,
    nextResult,
    async award(userId, amount, reason) {
      awarded.push({ userId, amount, reason })
      return fake.nextResult
    },
  }
  return fake
}
