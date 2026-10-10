import { and, eq, gte } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { userProgression } from '../../../../db/schema'
import type { StreakReminderAudience } from '../../application/ports/streakReminderAudience'
import { selectEngagementAudience } from './engagementAudience'

// Audiência do lembrete de sequência (EM.7.3): `user_progression` já guarda o dia da última
// atividade qualificada e a sequência atual, então a seleção é uma consulta só, sem chamar outro
// módulo por usuário.
export function createDrizzleStreakReminderAudience(db: Database): StreakReminderAudience {
  return {
    async listPage(afterUserId, limit, criteria) {
      const rows = await selectEngagementAudience(db, {
        afterUserId,
        limit,
        extra: and(
          eq(userProgression.lastQualifyingActivityDate, criteria.lastActivityDay),
          gte(userProgression.currentStreak, criteria.minStreak),
        ),
      })
      return rows.map((row) => ({
        userId: row.userId,
        address: row.address,
        name: row.name,
        currentStreak: row.currentStreak,
      }))
    },
  }
}
