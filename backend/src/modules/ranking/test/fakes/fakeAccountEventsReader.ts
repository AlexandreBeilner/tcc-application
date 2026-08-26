import type { AccountEventsReader } from '../../application/ports/accountEventsReader'
import type { MarketEventRecord } from '../../domain/networth'

export function createFakeAccountEventsReader(
  eventsByUserId: Record<string, MarketEventRecord[]> = {},
): AccountEventsReader {
  return {
    async listAllEvents(userId: string) {
      return eventsByUserId[userId] ?? []
    },
  }
}
