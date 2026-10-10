import { and, eq, ilike, inArray, ne } from 'drizzle-orm'
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

// Username aceita "_" (schemas.ts, regex /^[a-z0-9_]+$/), que o Postgres
// ILIKE trata como wildcard de 1 caractere — sem escapar, buscar por um
// username com "_" casa qualquer caractere naquela posição, devolvendo
// resultados incorretos. "\" escapado primeiro pra não dobrar o escape das
// duas trocas seguintes.
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
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

    async findByIds(ids) {
      if (ids.length === 0) {
        return []
      }
      const rows = await db.select().from(users).where(inArray(users.id, ids))
      return rows.map(toSummary)
    },

    async searchByUsername(query, excludeUserId) {
      const rows = await db
        .select()
        .from(users)
        .where(
          and(
            ilike(users.username, `%${escapeLikePattern(query)}%`),
            ne(users.id, excludeUserId),
            // Conta suspensa pelo painel (N.16) não aparece na busca de amigos.
            eq(users.status, 'active'),
          ),
        )
        .limit(20)
      return rows.map(toSummary)
    },
  }
}
