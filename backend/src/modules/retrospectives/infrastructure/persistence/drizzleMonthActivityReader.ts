import { and, count, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import {
  achievements,
  dailyActivity,
  duels,
  leagueMembers,
  leagues,
  userAchievements,
  userLessonProgress,
  userProgression,
  users,
} from '../../../../db/schema'
import type { MonthActivityReader } from '../../application/ports/monthActivityReader'

// Lê do mesmo banco `gamification` as contagens do mês de uma pessoa. Só contagens, nomes de
// conquista, nível e dias: nada financeiro (RNF09). Dia e mês em UTC, como o streak.
export function createDrizzleMonthActivityReader(db: Database): MonthActivityReader {
  return {
    async read(userId, range) {
      const [lessons] = await db
        .select({ total: count() })
        .from(userLessonProgress)
        .where(
          and(
            eq(userLessonProgress.userId, userId),
            isNotNull(userLessonProgress.completedAt),
            gte(userLessonProgress.completedAt, range.start),
            lt(userLessonProgress.completedAt, range.endExclusive),
          ),
        )

      const unlocked = await db
        .select({ name: achievements.name })
        .from(userAchievements)
        .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
        .where(
          and(
            eq(userAchievements.userId, userId),
            gte(userAchievements.unlockedAt, range.start),
            lt(userAchievements.unlockedAt, range.endExclusive),
          ),
        )
        .orderBy(userAchievements.unlockedAt)

      const [progression] = await db
        .select({ level: userProgression.level })
        .from(userProgression)
        .where(eq(userProgression.userId, userId))
        .limit(1)

      const days = await db
        .select({ day: dailyActivity.day })
        .from(dailyActivity)
        .where(
          and(
            eq(dailyActivity.userId, userId),
            gte(dailyActivity.day, range.firstDay),
            // `day` é do tipo date: até o último dia do mês, inclusive.
            lt(dailyActivity.day, range.endExclusive.toISOString().slice(0, 10)),
          ),
        )

      const finishedDuels = await db
        .select({
          challengerId: duels.challengerId,
          outcome: duels.outcome,
          reason: duels.reason,
        })
        .from(duels)
        .where(
          and(
            eq(duels.status, 'finished'),
            or(eq(duels.challengerId, userId), eq(duels.opponentId, userId)),
            gte(duels.finishedAt, range.start),
            lt(duels.finishedAt, range.endExclusive),
          ),
        )
      // Duelo em que ninguém operou não conta como duelo jogado.
      const played = finishedDuels.filter((d) => d.reason !== 'both_inactive')
      const won = played.filter(
        (d) =>
          (d.outcome === 'challenger' && d.challengerId === userId) ||
          (d.outcome === 'opponent' && d.challengerId !== userId),
      )

      const [leagueRow] = await db
        .select({ total: count() })
        .from(leagueMembers)
        .innerJoin(leagues, eq(leagues.id, leagueMembers.leagueId))
        .where(
          and(
            eq(leagueMembers.userId, userId),
            eq(leagueMembers.status, 'active'),
            isNull(leagues.closedAt),
          ),
        )

      return {
        lessonsCompleted: lessons.total,
        achievementNames: unlocked.map((u) => u.name),
        level: progression?.level ?? 1,
        activeDays: days.map((d) => Number(String(d.day).slice(8, 10))),
        duelsPlayed: played.length,
        duelsWon: won.length,
        leaguesActive: leagueRow.total,
      }
    },

    async findCreatedAt(userId) {
      const [row] = await db
        .select({ createdAt: users.createdAt })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.status, 'active')))
        .limit(1)
      return row?.createdAt ?? null
    },

    async listActiveUserIds() {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.status, 'active'))
      return rows.map((r) => r.id)
    },
  }
}
