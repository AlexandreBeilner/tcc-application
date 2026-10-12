import { and, asc, isNull, lt, or, gt } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { subscriptions } from '../../../../db/schema'
import type { ReconciliationAudience } from '../../application/ports/reconciliationAudience'

export function createDrizzleReconciliationAudience(db: Database): ReconciliationAudience {
  return {
    async findStale({ staleBefore, relevantSince, limit }) {
      const rows = await db
        .select({ userId: subscriptions.userId })
        .from(subscriptions)
        .where(
          and(
            lt(subscriptions.updatedAt, staleBefore),
            or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, relevantSince)),
          ),
        )
        // Os mais velhos primeiro: com mais candidatos que o lote, ninguém fica sem vez.
        .orderBy(asc(subscriptions.updatedAt))
        .limit(limit)
      return rows.map((row) => row.userId)
    },
  }
}
