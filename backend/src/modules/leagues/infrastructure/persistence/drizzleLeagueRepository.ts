import { and, count, desc, eq, isNull } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { leagueMembers, leagues, users } from '../../../../db/schema'
import type { LeagueRepository } from '../../application/ports/leagueRepository'
import type { League, LeagueMember, LeagueMemberStatus, LeagueWindow } from '../../domain/league'

function toLeague(row: typeof leagues.$inferSelect): League {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    window: row.windowKind as LeagueWindow,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
  }
}

function toMember(row: typeof leagueMembers.$inferSelect): LeagueMember {
  return {
    leagueId: row.leagueId,
    userId: row.userId,
    status: row.status as LeagueMemberStatus,
    invitedBy: row.invitedBy,
    createdAt: row.createdAt,
    joinedAt: row.joinedAt,
  }
}

export function createDrizzleLeagueRepository(db: Database): LeagueRepository {
  return {
    async createIfUnderLimit(input, maxOpen) {
      return db.transaction(async (tx) => {
        // Trava a linha do dono: duas criações simultâneas do mesmo dono se serializam aqui.
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, input.ownerId))
          .for('update')
        const [{ total }] = await tx
          .select({ total: count() })
          .from(leagues)
          .where(and(eq(leagues.ownerId, input.ownerId), isNull(leagues.closedAt)))
        if (total >= maxOpen) return null

        const [row] = await tx
          .insert(leagues)
          .values({
            ownerId: input.ownerId,
            name: input.name,
            windowKind: input.window,
            createdAt: input.now,
          })
          .returning()
        await tx.insert(leagueMembers).values({
          leagueId: row.id,
          userId: input.ownerId,
          status: 'active',
          invitedBy: input.ownerId,
          createdAt: input.now,
          joinedAt: input.now,
        })
        return toLeague(row)
      })
    },

    async findById(id) {
      const [row] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1)
      return row ? toLeague(row) : null
    },

    async rename(id, name) {
      await db.update(leagues).set({ name }).where(eq(leagues.id, id))
    },

    async close(id, at) {
      await db.update(leagues).set({ closedAt: at }).where(eq(leagues.id, id))
    },

    async listForUser(userId) {
      const rows = await db
        .select({ league: leagues, member: leagueMembers })
        .from(leagueMembers)
        .innerJoin(leagues, eq(leagues.id, leagueMembers.leagueId))
        .where(and(eq(leagueMembers.userId, userId), isNull(leagues.closedAt)))
        .orderBy(desc(leagues.createdAt))
      return rows.map((row) => ({ league: toLeague(row.league), membership: toMember(row.member) }))
    },

    async listMembers(leagueId) {
      const rows = await db.select().from(leagueMembers).where(eq(leagueMembers.leagueId, leagueId))
      return rows.map(toMember)
    },

    async findMember(leagueId, userId) {
      const [row] = await db
        .select()
        .from(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
        .limit(1)
      return row ? toMember(row) : null
    },

    async addMemberIfRoom(input, maxMembers) {
      return db.transaction(async (tx) => {
        // Trava a liga: dois convites simultâneos não passam do teto.
        await tx
          .select({ id: leagues.id })
          .from(leagues)
          .where(eq(leagues.id, input.leagueId))
          .for('update')
        const [{ total }] = await tx
          .select({ total: count() })
          .from(leagueMembers)
          .where(eq(leagueMembers.leagueId, input.leagueId))
        if (total >= maxMembers) return false
        await tx.insert(leagueMembers).values({
          leagueId: input.leagueId,
          userId: input.userId,
          status: input.status,
          invitedBy: input.invitedBy,
          createdAt: input.now,
          joinedAt: input.status === 'active' ? input.now : null,
        })
        return true
      })
    },

    async activateMember(leagueId, userId, at) {
      await db
        .update(leagueMembers)
        .set({ status: 'active', joinedAt: at })
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    },

    async removeMember(leagueId, userId) {
      await db
        .delete(leagueMembers)
        .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
    },
  }
}
