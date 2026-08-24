import type { XpAwarder } from '../../application/ports/xpAwarder'

export interface FakeXpAwarder extends XpAwarder {
  awarded: { userId: string; amount: number; reason: string }[]
}

export function createFakeXpAwarder(): FakeXpAwarder {
  const awarded: { userId: string; amount: number; reason: string }[] = []
  return {
    awarded,
    async award(userId, amount, reason) {
      awarded.push({ userId, amount, reason })
    },
  }
}
