import type { UserCashCreditor } from '../../application/ports/userCashCreditor'

export interface FakeUserCashCreditor extends UserCashCreditor {
  calls: { userId: string; amount: number }[]
  failWith?: Error
}

// Arredonda pra centavos como o motor.
export function createFakeUserCashCreditor(): FakeUserCashCreditor {
  const fake: FakeUserCashCreditor = {
    calls: [],
    failWith: undefined,
    async credit(userId, amount) {
      if (fake.failWith) throw fake.failWith
      fake.calls.push({ userId, amount })
      return { credited: Math.round(amount * 100) / 100 }
    },
  }
  return fake
}
