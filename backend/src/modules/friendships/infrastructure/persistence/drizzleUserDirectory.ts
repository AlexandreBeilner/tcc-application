import { and, eq, ilike, ne } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { UserDirectory, UserSummary } from '../../application/ports/userDirectory'

function toSummary(row: typeof users.$inferSelect): UserSummary {
  return { id: row.id, username: row.username, name: row.name }
}

// Todo usuário é buscável — não há perfil privado nesta fase (spec 8.2,
// CLAUDE.md). Busca por `username` (ILIKE, contains), não por `name`.
export function createDrizzleUserDirectory(db: Database): UserDirectory {
  return {
    async findByUsername(username) {
      const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1)
      return row ? toSummary(row) : undefined
    },

    async findById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      return row ? toSummary(row) : undefined
    },

    async searchByUsername(query, excludeUserId) {
      const rows = await db
        .select()
        .from(users)
        .where(and(ilike(users.username, `%${query}%`), ne(users.id, excludeUserId)))
        .limit(20)
      return rows.map(toSummary)
    },
  }
}
