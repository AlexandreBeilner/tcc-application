import { and, count, eq, gte, lte, min } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { emailOutbox } from '../../../../db/schema'
import type { EmailOutboxHealthReader } from '../../application/ports/emailOutboxHealthReader'

const DAY_MS = 24 * 60 * 60_000

export function createDrizzleEmailOutboxHealthReader(db: Database): EmailOutboxHealthReader {
  return {
    async read(now) {
      const [pending] = await db
        .select({ total: count(), oldest: min(emailOutbox.nextAttemptAt) })
        .from(emailOutbox)
        .where(and(eq(emailOutbox.status, 'pending'), lte(emailOutbox.nextAttemptAt, now)))
      const [failed] = await db
        .select({ total: count() })
        .from(emailOutbox)
        .where(
          and(
            eq(emailOutbox.status, 'failed'),
            gte(emailOutbox.createdAt, new Date(now.getTime() - DAY_MS)),
          ),
        )
      return {
        pending: pending.total,
        failedLast24h: failed.total,
        oldestPendingAgeMs: pending.oldest ? now.getTime() - pending.oldest.getTime() : null,
      }
    },
  }
}
