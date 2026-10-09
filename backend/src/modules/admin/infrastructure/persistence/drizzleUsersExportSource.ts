import { and, asc, gte, lte } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { ExportSource } from '../../application/ports/exportSource'

// Privacidade (RNF09, LGPD): o arquivo traz identificação e estado da conta e NUNCA o hash de
// senha, o token, o patrimônio nem a rentabilidade. O e-mail é dado pessoal, por isso a rota
// pede senha recente e a exportação fica auditada.
export function createDrizzleUsersExportSource(db: Database): ExportSource {
  return {
    async fetch(range, limit) {
      const filters: SQL[] = []
      if (range.from) filters.push(gte(users.createdAt, range.from))
      if (range.to) filters.push(lte(users.createdAt, range.to))

      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          username: users.username,
          role: users.role,
          status: users.status,
          onboardingCompleted: users.onboardingCompleted,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(asc(users.createdAt), asc(users.id))
        .limit(limit + 1)

      const truncated = rows.length > limit
      return {
        columns: [
          'id',
          'name',
          'email',
          'username',
          'role',
          'status',
          'onboarding_completed',
          'created_at',
        ],
        rows: rows
          .slice(0, limit)
          .map((u) => [
            u.id,
            u.name,
            u.email,
            u.username,
            u.role,
            u.status,
            u.onboardingCompleted,
            u.createdAt,
          ]),
        truncated,
      }
    },
  }
}
