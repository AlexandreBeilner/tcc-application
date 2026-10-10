import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyMissions, rankingSnapshots, userMissionProgress } from '../../../../db/schema'
import { utcDateString } from '../../../../shared/utcDate'
import type { WeeklyDigestAudience } from '../../application/ports/weeklyDigestAudience'
import { selectEngagementAudience } from './engagementAudience'

// Audiência do resumo semanal (EM.7.1). Rentabilidade da semana vem do último ranking calculado
// (`ranking_snapshots`, critério geral, janela semanal), nunca do motor: o job não faz chamada de
// rede por usuário. Só percentual e nível saem daqui (RNF09).
export function createDrizzleWeeklyDigestAudience(
  db: Database,
  now: () => Date = () => new Date(),
): WeeklyDigestAudience {
  return {
    async listPage(afterUserId, limit) {
      const base = await selectEngagementAudience(db, { afterUserId, limit })
      if (base.length === 0) return []
      const ids = base.map((row) => row.userId)

      const [latest] = await db
        .select({ runId: rankingSnapshots.runId })
        .from(rankingSnapshots)
        .orderBy(desc(rankingSnapshots.computedAt))
        .limit(1)
      const returns = latest
        ? await db
            .select({ userId: rankingSnapshots.userId, pct: rankingSnapshots.profitabilityPct })
            .from(rankingSnapshots)
            .where(
              and(
                eq(rankingSnapshots.runId, latest.runId),
                eq(rankingSnapshots.windowKind, 'week'),
                eq(rankingSnapshots.criterion, 'overall'),
                inArray(rankingSnapshots.userId, ids),
              ),
            )
        : []
      const returnByUser = new Map(returns.map((r) => [r.userId, r.pct]))

      // Missões ativas menos as já concluídas hoje (o progresso do dia nasce sob demanda, então
      // quem não abriu a tela ainda não tem linha: tudo está pendente).
      const missions = await db
        .select({ id: dailyMissions.id, title: dailyMissions.title, xp: dailyMissions.xpReward })
        .from(dailyMissions)
        .where(eq(dailyMissions.isActive, true))
        .orderBy(desc(dailyMissions.xpReward))
      const done = await db
        .select({ userId: userMissionProgress.userId, missionId: userMissionProgress.missionId })
        .from(userMissionProgress)
        .where(
          and(
            eq(userMissionProgress.missionDate, utcDateString(now())),
            eq(userMissionProgress.status, 'completed'),
            inArray(userMissionProgress.userId, ids),
          ),
        )
      const doneByUser = new Map<string, Set<string>>()
      for (const row of done) {
        const set = doneByUser.get(row.userId) ?? new Set<string>()
        set.add(row.missionId)
        doneByUser.set(row.userId, set)
      }

      return base.map((row) => {
        const completed = doneByUser.get(row.userId)
        const pending = missions.filter((m) => !completed?.has(m.id))
        return {
          userId: row.userId,
          address: row.address,
          name: row.name,
          level: row.level,
          weeklyReturnPct: returnByUser.get(row.userId) ?? null,
          pendingMissions: pending.length,
          pendingMissionTitle: pending[0]?.title ?? null,
        }
      })
    },
  }
}
