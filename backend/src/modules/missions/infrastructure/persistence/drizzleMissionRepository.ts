import { and, eq } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyMissions, userMissionProgress } from '../../../../db/schema'
import type { MissionRepository } from '../../application/ports/missionRepository'
import type { Mission, MissionProgressSnapshot } from '../../domain/mission'

function toMission(row: typeof dailyMissions.$inferSelect): Mission {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completionCriteria: row.completionCriteria,
    xpReward: row.xpReward,
    requiresLessonCompletion: row.requiresLessonCompletion,
  }
}

export function createDrizzleMissionRepository(db: Database): MissionRepository {
  return {
    async listCatalog() {
      const rows = await db.select().from(dailyMissions)
      return rows.map(toMission)
    },

    async findById(id) {
      const [row] = await db.select().from(dailyMissions).where(eq(dailyMissions.id, id)).limit(1)
      return row ? toMission(row) : undefined
    },

    async ensureTodayProgress(userId: string, missionIds: string[], missionDate: string) {
      if (missionIds.length === 0) {
        return
      }
      await db
        .insert(userMissionProgress)
        .values(missionIds.map((missionId) => ({ userId, missionId, missionDate })))
        .onConflictDoNothing({
          target: [
            userMissionProgress.userId,
            userMissionProgress.missionId,
            userMissionProgress.missionDate,
          ],
        })
    },

    async listProgressForDate(userId: string, missionDate: string) {
      const rows = await db
        .select()
        .from(userMissionProgress)
        .where(
          and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.missionDate, missionDate),
          ),
        )
      return rows.map((row) => ({ missionId: row.missionId, status: row.status }))
    },

    async findProgress(userId: string, missionId: string, missionDate: string) {
      const [row] = await db
        .select()
        .from(userMissionProgress)
        .where(
          and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.missionId, missionId),
            eq(userMissionProgress.missionDate, missionDate),
          ),
        )
        .limit(1)
      return row ? ({ status: row.status } satisfies MissionProgressSnapshot) : undefined
    },

    async markCompleted(userId: string, missionId: string, missionDate: string) {
      await db
        .insert(userMissionProgress)
        .values({ userId, missionId, missionDate, status: 'completed', completedAt: new Date() })
        .onConflictDoUpdate({
          target: [
            userMissionProgress.userId,
            userMissionProgress.missionId,
            userMissionProgress.missionDate,
          ],
          set: { status: 'completed', completedAt: new Date() },
        })
    },
  }
}
