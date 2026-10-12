import type { EmailOutboxHealthReader } from '../../application/ports/emailOutboxHealthReader'
import type { OutboxStats } from '../../domain/systemHealth'

export function createFakeEmailOutboxHealthReader(
  stats: Partial<OutboxStats> = {},
): EmailOutboxHealthReader {
  return {
    async read() {
      return { pending: 0, failedLast24h: 0, oldestPendingAgeMs: null, ...stats }
    },
  }
}
