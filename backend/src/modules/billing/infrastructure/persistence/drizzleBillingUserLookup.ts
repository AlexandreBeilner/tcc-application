import { inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { BillingUserLookup } from '../../application/ports/billingUserLookup'

export function createDrizzleBillingUserLookup(db: Database): BillingUserLookup {
  return {
    async existingUserIds(candidateIds) {
      if (candidateIds.length === 0) return []
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, candidateIds))
      return rows.map((row) => row.id)
    },
  }
}
