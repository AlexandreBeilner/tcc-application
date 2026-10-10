import { and, count, eq, not, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { userAchievements, users } from '../../../../db/schema'
import type { AchievementRarityReader } from '../../application/ports/achievementRarityReader'

// Só conta quem é jogador de verdade: usuário comum, ativo e não anonimizado. Admin e conta
// excluída não diluem nem inflam a raridade.
const countsAsPlayer = and(
  eq(users.role, 'user'),
  eq(users.status, 'active'),
  not(sql`${users.email} LIKE '%.invalid'`),
)

export function createDrizzleAchievementRarityReader(db: Database): AchievementRarityReader {
  return {
    async getRarity(achievementId) {
      const [holders] = await db
        .select({ total: count() })
        .from(userAchievements)
        .innerJoin(users, eq(users.id, userAchievements.userId))
        .where(and(eq(userAchievements.achievementId, achievementId), countsAsPlayer))
      const [population] = await db.select({ total: count() }).from(users).where(countsAsPlayer)
      return { holders: Number(holders.total), population: Number(population.total) }
    },
  }
}
