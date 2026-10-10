import type { EmailSuppressionRepository } from '../../application/ports/emailSuppressionRepository'
import type { SuppressionReason } from '../../domain/suppression'

const RANK: Record<SuppressionReason, number> = { bounce: 3, complaint: 2, unsubscribe_all: 1 }

export interface FakeEmailSuppressionRepository extends EmailSuppressionRepository {
  entries: Map<string, SuppressionReason>
}

export function createFakeEmailSuppressionRepository(
  initial: Record<string, SuppressionReason> = {},
): FakeEmailSuppressionRepository {
  const entries = new Map<string, SuppressionReason>(Object.entries(initial))
  return {
    entries,
    async find(address) {
      return entries.get(address) ?? null
    },
    async add(address, reason) {
      const current = entries.get(address)
      if (!current || RANK[reason] > RANK[current]) entries.set(address, reason)
    },
  }
}
