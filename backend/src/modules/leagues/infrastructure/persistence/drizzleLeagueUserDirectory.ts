import { inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import { buildAvatarUrl } from '../../../../shared/avatarUrl'
import type { LeagueUserDirectory } from '../../application/ports/leagueUserDirectory'

export function createDrizzleLeagueUserDirectory(db: Database): LeagueUserDirectory {
  return {
    async findByIds(ids) {
      if (ids.length === 0) return []
      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          avatarPath: users.avatarPath,
        })
        .from(users)
        .where(inArray(users.id, ids))
      return rows.map((row) => ({
        id: row.id,
        username: row.username,
        name: row.name,
        avatarUrl: buildAvatarUrl(row.avatarPath),
      }))
    },
  }
}
