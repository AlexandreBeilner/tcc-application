import type { CurrentAccountStateReader } from '../../application/ports/currentAccountStateReader'
import type { Snapshot } from '../../domain/networth'

const EMPTY_SNAPSHOT: Snapshot = {
  cash: 0,
  variableIncomeValue: 0,
  fixedIncomeValue: 0,
  tradesExecuted: 0,
  total: 0,
}

export function createFakeCurrentAccountStateReader(
  snapshotByUserId: Record<string, Snapshot> = {},
): CurrentAccountStateReader {
  return {
    async getCurrentSnapshot(userId: string) {
      return snapshotByUserId[userId] ?? EMPTY_SNAPSHOT
    },
  }
}
