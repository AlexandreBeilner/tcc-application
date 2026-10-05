import { and, count, desc, eq, exists, gte, ilike, inArray, isNotNull, lte, or } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { userIdentities, users } from '../../../../db/schema'
import type { AdminUserDirectory } from '../../application/ports/adminUserDirectory'
import type { AdminUserSummary } from '../../domain/adminUser'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "%" e "_" são curingas do ILIKE; o texto do admin é literal.
function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export function createDrizzleAdminUserDirectory(db: Database): AdminUserDirectory {
  return {
    async list(query) {
      const filters: SQL[] = []
      const text = query.q?.trim()
      if (text) {
        const like = `%${escapeLike(text)}%`
        const matches: SQL[] = [
          ilike(users.name, like),
          ilike(users.email, like),
          ilike(users.username, like),
        ]
        if (UUID_PATTERN.test(text)) matches.push(eq(users.id, text.toLowerCase()))
        filters.push(or(...matches) as SQL)
      }
      if (query.role) filters.push(eq(users.role, query.role))
      if (query.status) filters.push(eq(users.status, query.status))
      if (query.provider === 'password') {
        filters.push(isNotNull(users.passwordHash))
      } else if (query.provider) {
        filters.push(
          exists(
            db
              .select({ one: userIdentities.id })
              .from(userIdentities)
              .where(
                and(
                  eq(userIdentities.userId, users.id),
                  eq(userIdentities.providerName, query.provider),
                ),
              ),
          ),
        )
      }
      if (query.createdFrom) filters.push(gte(users.createdAt, query.createdFrom))
      if (query.createdTo) filters.push(lte(users.createdAt, query.createdTo))
      const where = filters.length > 0 ? and(...filters) : undefined

      const rows = await db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(query.limit)
        .offset(query.offset)
      const [{ total }] = await db.select({ total: count() }).from(users).where(where)

      // Provedores só da página exibida: uma consulta, não uma por usuário.
      const identities =
        rows.length === 0
          ? []
          : await db
              .select({ userId: userIdentities.userId, providerName: userIdentities.providerName })
              .from(userIdentities)
              .where(
                inArray(
                  userIdentities.userId,
                  rows.map((row) => row.id),
                ),
              )
      const providersByUser = new Map<string, string[]>()
      for (const identity of identities) {
        providersByUser.set(identity.userId, [
          ...(providersByUser.get(identity.userId) ?? []),
          identity.providerName,
        ])
      }

      return {
        users: rows.map((row): AdminUserSummary => ({
          id: row.id,
          name: row.name,
          email: row.email,
          username: row.username,
          role: row.role,
          status: row.status as AdminUserSummary['status'],
          onboardingCompleted: row.onboardingCompleted,
          providers: [
            ...(row.passwordHash !== null ? ['password'] : []),
            ...(providersByUser.get(row.id) ?? []),
          ],
          createdAt: row.createdAt,
        })),
        total,
      }
    },
  }
}
