import { and, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { duels, users } from '../../../../db/schema'
import type { DuelRepository } from '../../application/ports/duelRepository'
import type { Duel, DuelOutcome, DuelReason, DuelStatus } from '../../domain/duel'

function toDuel(row: typeof duels.$inferSelect): Duel {
  return {
    id: row.id,
    challengerId: row.challengerId,
    opponentId: row.opponentId,
    status: row.status as DuelStatus,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    finishedAt: row.finishedAt,
    outcome: row.outcome as DuelOutcome | null,
    reason: row.reason as DuelReason | null,
    challengerPct: row.challengerPct,
    opponentPct: row.opponentPct,
    challengerOperated: row.challengerOperated,
    opponentOperated: row.opponentOperated,
    xpAwardedAt: row.xpAwardedAt,
  }
}

// Vagas ocupadas: duelos ativos (nos dois lados) mais desafios aguardando feitos pela pessoa.
function slotsUsedBy(userId: string) {
  return or(
    and(
      eq(duels.status, 'active'),
      or(eq(duels.challengerId, userId), eq(duels.opponentId, userId)),
    ),
    and(eq(duels.status, 'pending'), eq(duels.challengerId, userId)),
  )
}

export function createDrizzleDuelRepository(db: Database): DuelRepository {
  // Muda o estado só se o duelo ainda está no estado esperado; `false` se perdeu a corrida.
  async function transition(
    id: string,
    from: DuelStatus,
    set: Partial<typeof duels.$inferInsert>,
  ): Promise<boolean> {
    const rows = await db
      .update(duels)
      .set(set)
      .where(and(eq(duels.id, id), eq(duels.status, from)))
      .returning({ id: duels.id })
    return rows.length > 0
  }

  return {
    async createIfRoom(input, maxSlots) {
      return db.transaction(async (tx) => {
        // Trava a linha de quem desafia: dois desafios simultâneos da mesma pessoa se serializam.
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, input.challengerId))
          .for('update')
        const [{ total }] = await tx
          .select({ total: sql<number>`count(*)::int` })
          .from(duels)
          .where(slotsUsedBy(input.challengerId))
        if (total >= maxSlots) return null
        const [row] = await tx
          .insert(duels)
          .values({
            challengerId: input.challengerId,
            opponentId: input.opponentId,
            status: 'pending',
            createdAt: input.now,
            expiresAt: input.expiresAt,
          })
          .returning()
        return toDuel(row)
      })
    },

    async findById(id) {
      const [row] = await db.select().from(duels).where(eq(duels.id, id)).limit(1)
      return row ? toDuel(row) : null
    },

    async findOpenBetween(userAId, userBId) {
      const [row] = await db
        .select()
        .from(duels)
        .where(
          and(
            inArray(duels.status, ['pending', 'active']),
            or(
              and(eq(duels.challengerId, userAId), eq(duels.opponentId, userBId)),
              and(eq(duels.challengerId, userBId), eq(duels.opponentId, userAId)),
            ),
          ),
        )
        .limit(1)
      return row ? toDuel(row) : null
    },

    async listForUser(userId, limit) {
      const rows = await db
        .select()
        .from(duels)
        .where(or(eq(duels.challengerId, userId), eq(duels.opponentId, userId)))
        .orderBy(desc(duels.createdAt))
        .limit(limit)
      return rows.map(toDuel)
    },

    async acceptIfRoom(id, opponentId, startsAt, endsAt, maxSlots) {
      return db.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, opponentId)).for('update')
        const [current] = await tx.select().from(duels).where(eq(duels.id, id)).for('update')
        if (!current || current.status !== 'pending' || current.opponentId !== opponentId)
          return 'gone'
        const [{ total }] = await tx
          .select({ total: sql<number>`count(*)::int` })
          .from(duels)
          .where(slotsUsedBy(opponentId))
        if (total >= maxSlots) return 'full'
        await tx.update(duels).set({ status: 'active', startsAt, endsAt }).where(eq(duels.id, id))
        return 'accepted'
      })
    },

    decline: (id, at) => transition(id, 'pending', { status: 'declined', finishedAt: at }),
    cancel: (id, at) => transition(id, 'pending', { status: 'cancelled', finishedAt: at }),
    expire: (id, at) => transition(id, 'pending', { status: 'expired', finishedAt: at }),

    finish: (id, result, at) =>
      transition(id, 'active', {
        status: 'finished',
        finishedAt: at,
        outcome: result.outcome,
        reason: result.reason,
        challengerPct: result.challengerPct,
        opponentPct: result.opponentPct,
        challengerOperated: result.challengerOperated,
        opponentOperated: result.opponentOperated,
      }),

    async listDueActive(now) {
      const rows = await db
        .select()
        .from(duels)
        .where(and(eq(duels.status, 'active'), lte(duels.endsAt, now)))
        .orderBy(duels.endsAt)
      return rows.map(toDuel)
    },

    async listExpiredPending(now) {
      const rows = await db
        .select()
        .from(duels)
        .where(and(eq(duels.status, 'pending'), lte(duels.expiresAt, now)))
      return rows.map(toDuel)
    },

    async listFinishedWithoutXp(limit) {
      const rows = await db
        .select()
        .from(duels)
        .where(and(eq(duels.status, 'finished'), isNull(duels.xpAwardedAt)))
        .limit(limit)
      return rows.map(toDuel)
    },

    async markXpAwarded(id, at) {
      await db.update(duels).set({ xpAwardedAt: at }).where(eq(duels.id, id))
    },
  }
}
