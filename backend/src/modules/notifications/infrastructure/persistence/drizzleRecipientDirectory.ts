import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { RecipientDirectory } from '../../application/ports/recipientDirectory'

export function createDrizzleRecipientDirectory(db: Database): RecipientDirectory {
  return {
    async find(userId) {
      const [row] = await db
        .select({
          email: users.email,
          status: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      if (!row) return null
      return {
        address: row.email,
        status: row.status === 'suspended' ? 'suspended' : 'active',
        emailVerified: row.emailVerifiedAt !== null,
      }
    },
  }
}
