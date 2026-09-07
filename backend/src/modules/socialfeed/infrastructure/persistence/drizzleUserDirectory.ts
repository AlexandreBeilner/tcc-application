import { inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import { buildAvatarUrl } from '../../../../shared/avatarUrl'
import type { UserDirectory, UserSummary } from '../../application/ports/userDirectory'

function toSummary(row: typeof users.$inferSelect): UserSummary {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatarUrl: buildAvatarUrl(row.avatarPath),
  }
}

export function createDrizzleUserDirectory(db: Database): UserDirectory {
  return {
    async findByIds(ids) {
      if (ids.length === 0) {
        return []
      }
      const rows = await db.select().from(users).where(inArray(users.id, ids))
      return rows.map(toSummary)
    },
  }
}
