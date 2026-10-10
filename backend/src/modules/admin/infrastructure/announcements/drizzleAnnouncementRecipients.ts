import { and, asc, eq, gt, isNotNull, notLike } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { AnnouncementRecipients } from '../../application/ports/announcementBroadcast'

// Contas ativas (suspensa só recebe o aviso de suspensão), com e-mail verificado (D2) e que não
// foram anonimizadas (`@anonimo.invalid` nunca é entregável).
export function createDrizzleAnnouncementRecipients(db: Database): AnnouncementRecipients {
  return {
    async listPage(afterUserId, limit) {
      const rows = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(
          and(
            eq(users.status, 'active'),
            isNotNull(users.emailVerifiedAt),
            notLike(users.email, '%@anonimo.invalid'),
            afterUserId ? gt(users.id, afterUserId) : undefined,
          ),
        )
        .orderBy(asc(users.id))
        .limit(limit)
      return rows.map((row) => ({ userId: row.id, email: row.email, name: row.name }))
    },
  }
}
