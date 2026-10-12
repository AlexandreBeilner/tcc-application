import type { UserProGrants, UserProStatus } from '../../application/ports/userProGrants'

export interface FakeUserProGrants extends UserProGrants {
  granted: Array<{ userId: string; endsAt: Date }>
  accessEnd: Date | null
  status: UserProStatus
  errorToThrow?: Error
}

export function createFakeUserProGrants(): FakeUserProGrants {
  const fake: FakeUserProGrants = {
    granted: [],
    accessEnd: null,
    status: { isPro: false, state: 'none', plan: null, store: null, expiresAt: null },
    async statusOf() {
      return fake.status
    },
    async currentAccessEnd() {
      return fake.accessEnd
    },
    async grantUntil(userId, endsAt) {
      if (fake.errorToThrow) throw fake.errorToThrow
      fake.granted.push({ userId, endsAt })
    },
  }
  return fake
}
