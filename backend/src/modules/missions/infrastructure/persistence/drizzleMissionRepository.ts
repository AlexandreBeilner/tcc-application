import { and, countDistinct, eq, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { dailyMissions, userMissionProgress } from '../../../../db/schema'
import type { MissionRepository } from '../../application/ports/missionRepository'
import type { Mission, MissionProgressSnapshot } from '../../domain/mission'

function toMission(row: typeof dailyMissions.$inferSelect): Mission {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    completionCriteria: row.completionCriteria,
    xpReward: row.xpReward,
    requiresLessonCompletion: row.requiresLessonCompletion,
    isActive: row.isActive,
  }
}

export function createDrizzleMissionRepository(db: Database): MissionRepository {
  return {
    async listCatalog() {
      const rows = await db.select().from(dailyMissions).where(eq(dailyMissions.isActive, true))
      return rows.map(toMission)
    },

    async listAll() {
      const rows = await db.select().from(dailyMissions)
      return rows.map(toMission)
    },

    async update(id, patch) {
      const set: Partial<typeof dailyMissions.$inferInsert> = {}
      if (patch.title !== undefined) set.title = patch.title
      if (patch.description !== undefined) set.description = patch.description
      if (patch.xpReward !== undefined) set.xpReward = patch.xpReward
      if (patch.isActive !== undefined) set.isActive = patch.isActive
      if (Object.keys(set).length === 0) {
        const [current] = await db
          .select()
          .from(dailyMissions)
          .where(eq(dailyMissions.id, id))
          .limit(1)
        return current ? toMission(current) : undefined
      }
      const [row] = await db
        .update(dailyMissions)
        .set(set)
        .where(eq(dailyMissions.id, id))
        .returning()
      return row ? toMission(row) : undefined
    },

    async countCompletions(today) {
      const rows = await db
        .select({
          missionId: userMissionProgress.missionId,
          users: countDistinct(userMissionProgress.userId),
          today: sql<number>`count(distinct ${userMissionProgress.userId}) filter (where ${userMissionProgress.missionDate} = ${today})`,
        })
        .from(userMissionProgress)
        .where(eq(userMissionProgress.status, 'completed'))
        .groupBy(userMissionProgress.missionId)
      return new Map(
        rows.map((row) => [row.missionId, { users: Number(row.users), today: Number(row.today) }]),
      )
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

    async listAllProgressForUser(userId: string) {
      const rows = await db
        .select()
        .from(userMissionProgress)
        .where(eq(userMissionProgress.userId, userId))
      return rows.map((row) => ({
        missionId: row.missionId,
        missionDate: row.missionDate,
        status: row.status,
        completedAt: row.completedAt,
      }))
    },

    async markCompleted(userId: string, missionId: string, missionDate: string) {
      // `setWhere` faz o UPDATE do conflito só disparar se a linha
      // conflitante ainda estiver `pending` — o Postgres serializa duas
      // transações concorrentes que conflitam na mesma linha (lock de
      // linha), então só uma vê `status = 'pending'` e ganha o RETURNING;
      // a outra, ao ser liberada, já enxerga `completed` e o predicado
      // falha (nenhuma linha retornada). Sem isso, duas requisições
      // concorrentes creditariam xp em dobro (CompleteMissionUseCase só
      // credita quando este método devolve `true`).
      const [claimed] = await db
        .insert(userMissionProgress)
        .values({ userId, missionId, missionDate, status: 'completed', completedAt: new Date() })
        .onConflictDoUpdate({
          target: [
            userMissionProgress.userId,
            userMissionProgress.missionId,
            userMissionProgress.missionDate,
          ],
          set: { status: 'completed', completedAt: new Date() },
          setWhere: eq(userMissionProgress.status, 'pending'),
        })
        .returning({ id: userMissionProgress.id })
      return claimed !== undefined
    },
  }
}
