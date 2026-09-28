import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { UserDirectory } from '../../application/ports/userDirectory'

export function createDrizzleUserDirectory(db: Database): UserDirectory {
  return {
    async listAllUserIds() {
      const rows = await db.select({ id: users.id }).from(users)
      return rows.map((row) => row.id)
    },
  }
}
