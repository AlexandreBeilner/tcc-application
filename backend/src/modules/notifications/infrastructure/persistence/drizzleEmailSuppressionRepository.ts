import { eq, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { emailSuppressions } from '../../../../db/schema'
import type { EmailSuppressionRepository } from '../../application/ports/emailSuppressionRepository'
import type { SuppressionReason } from '../../domain/suppression'

// Gravidade usada pra nunca "perdoar": bounce (3) > complaint (2) > unsubscribe_all (1).
const rank = (reason: ReturnType<typeof sql>) =>
  sql`(CASE ${reason} WHEN 'bounce' THEN 3 WHEN 'complaint' THEN 2 ELSE 1 END)`

export function createDrizzleEmailSuppressionRepository(db: Database): EmailSuppressionRepository {
  return {
    async find(address) {
      const [row] = await db
        .select({ reason: emailSuppressions.reason })
        .from(emailSuppressions)
        .where(eq(emailSuppressions.address, address))
        .limit(1)
      return (row?.reason as SuppressionReason | undefined) ?? null
    },

    async add(address, reason, now) {
      await db
        .insert(emailSuppressions)
        .values({ address, reason, createdAt: now })
        .onConflictDoUpdate({
          target: emailSuppressions.address,
          set: { reason },
          setWhere: sql`${rank(sql`excluded.reason`)} > ${rank(sql`${emailSuppressions.reason}`)}`,
        })
    },
  }
}
