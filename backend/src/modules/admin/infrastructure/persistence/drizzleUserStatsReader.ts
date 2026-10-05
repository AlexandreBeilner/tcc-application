import { count, eq, gte, and } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { users } from '../../../../db/schema'
import type { UserStatsReader } from '../../application/ports/userStatsReader'

const DAY_MS = 24 * 60 * 60 * 1000

export function createDrizzleUserStatsReader(db: Database): UserStatsReader {
  const signupsSince = async (since: Date) => {
    const [row] = await db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.role, 'user'), gte(users.createdAt, since)))
    return row.n
  }

  return {
    async read(now) {
      const [total] = await db.select({ n: count() }).from(users).where(eq(users.role, 'user'))
      return {
        total: total.n,
        signups_last_24h: await signupsSince(new Date(now.getTime() - DAY_MS)),
        signups_last_7d: await signupsSince(new Date(now.getTime() - 7 * DAY_MS)),
      }
    },
  }
}
