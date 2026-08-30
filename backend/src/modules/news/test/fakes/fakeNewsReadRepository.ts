import type { NewsReadRepository } from '../../application/ports/newsReadRepository'

export interface FakeNewsReadRepository extends NewsReadRepository {
  seen: Set<string>
  listCalls: { userId: string; macroEventIds: string[] }[]
  markCalls: { userId: string; macroEventId: string }[]
}

function key(userId: string, macroEventId: string): string {
  return `${userId}:${macroEventId}`
}

export function createFakeNewsReadRepository(
  initiallySeen: { userId: string; macroEventId: string }[] = [],
): FakeNewsReadRepository {
  const seen = new Set(initiallySeen.map((row) => key(row.userId, row.macroEventId)))
  const listCalls: FakeNewsReadRepository['listCalls'] = []
  const markCalls: FakeNewsReadRepository['markCalls'] = []

  return {
    seen,
    listCalls,
    markCalls,
    async listSeenEventIds(userId, macroEventIds) {
      listCalls.push({ userId, macroEventIds })
      return new Set(macroEventIds.filter((id) => seen.has(key(userId, id))))
    },
    async markAsSeen(userId, macroEventId) {
      markCalls.push({ userId, macroEventId })
      seen.add(key(userId, macroEventId))
    },
  }
}
