import { eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { UserDirectory } from '../../application/ports/userDirectory'

export function createDrizzleUserDirectory(db: Database): UserDirectory {
  return {
    async findById(id) {
      const [row] = await db
        .select({
          id: users.id,
          username: users.username,
          createdAt: users.createdAt,
          avatarPath: users.avatarPath,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
      return row
    },
  }
}
