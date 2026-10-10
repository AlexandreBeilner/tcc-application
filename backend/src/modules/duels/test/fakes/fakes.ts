import type {
  DuelPerformance,
  DuelPerformanceReader,
} from '../../application/ports/duelPerformanceReader'
import type { DuelFeedRecorder, XpGrant } from '../../application/ports/duelSideEffects'
import type { DuelUser, DuelUserDirectory } from '../../application/ports/duelUserDirectory'
import type { FriendshipChecker } from '../../application/ports/friendshipChecker'
import type { ProAccess } from '../../application/ports/proAccess'

export function createFakeProAccess(proIds: string[]): ProAccess & { ids: Set<string> } {
  const ids = new Set(proIds)
  return {
    ids,
    async assertPro(userId) {
      if (!ids.has(userId))
        throw Object.assign(new Error('requer plano PRO'), { code: 'PRO_REQUIRED' })
    },
  }
}

export function createFakeFriendships(pairs: [string, string][]): FriendshipChecker {
  return {
    async areFriends(a, b) {
      return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
    },
  }
}

export function createFakeUsers(ids: string[]): DuelUserDirectory {
  const users: DuelUser[] = ids.map((id) => ({
    id,
    username: id,
    name: id.toUpperCase(),
    avatarUrl: null,
  }))
  return { findByIds: async (wanted) => users.filter((u) => wanted.includes(u.id)) }
}

export interface FakePerformance extends DuelPerformanceReader {
  byUser: Record<string, DuelPerformance>
  calls: { userId: string; from: Date; to: Date }[]
  failFor: Set<string>
}

export function createFakePerformance(byUser: Record<string, DuelPerformance>): FakePerformance {
  const fake: FakePerformance = {
    byUser,
    calls: [],
    failFor: new Set(),
    async measure(userId, from, to) {
      fake.calls.push({ userId, from, to })
      if (fake.failFor.has(userId)) throw new Error('motor fora do ar')
      return fake.byUser[userId] ?? { returnPct: 0, operated: false }
    },
  }
  return fake
}

export function createFakeXp(): XpGrant & {
  grants: { userId: string; amount: number; reason: string }[]
} {
  const grants: { userId: string; amount: number; reason: string }[] = []
  return {
    grants,
    async award(userId, amount, reason) {
      grants.push({ userId, amount, reason })
    },
  }
}

export function createFakeFeed(): DuelFeedRecorder & {
  items: Parameters<DuelFeedRecorder['recordResult']>[0][]
} {
  const items: Parameters<DuelFeedRecorder['recordResult']>[0][] = []
  return {
    items,
    async recordResult(input) {
      items.push(input)
    },
  }
}
