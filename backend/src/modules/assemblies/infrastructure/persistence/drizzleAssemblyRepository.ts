import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import {
  assemblies,
  assemblyOptions,
  assemblyVoteCredits,
  assemblyVotes,
} from '../../../../db/schema'
import type {
  AssemblyRepository,
  AssemblyWithOptions,
} from '../../application/ports/assemblyRepository'
import type {
  AgendaOption,
  Assembly,
  AssemblyOutcome,
  AssemblyOutcomeReason,
  AssemblyStatus,
} from '../../domain/assembly'

function toAssembly(row: typeof assemblies.$inferSelect): Assembly {
  return {
    id: row.id,
    kind: row.kind,
    subjectRef: row.subjectRef,
    dedupeKey: row.dedupeKey,
    status: row.status as AssemblyStatus,
    opensAt: row.opensAt,
    snapshotAt: row.snapshotAt,
    closesAt: row.closesAt,
    effectAppliesAt: row.effectAppliesAt,
    outcome: row.outcome as AssemblyOutcome | null,
    outcomeReason: row.outcomeReason as AssemblyOutcomeReason | null,
    winningOptionId: row.winningOptionId,
    voterCount: row.voterCount,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  }
}

function toOption(row: typeof assemblyOptions.$inferSelect): AgendaOption {
  return {
    id: row.id,
    assemblyId: row.assemblyId,
    key: row.key,
    label: row.label,
    gain: row.gain,
    loss: row.loss,
    effect: row.effect as Record<string, unknown>,
    position: row.position,
  }
}

export function createDrizzleAssemblyRepository(db: Database): AssemblyRepository {
  async function load(id: string): Promise<AssemblyWithOptions | null> {
    const [row] = await db.select().from(assemblies).where(eq(assemblies.id, id))
    if (!row) return null
    const options = await db
      .select()
      .from(assemblyOptions)
      .where(eq(assemblyOptions.assemblyId, id))
      .orderBy(asc(assemblyOptions.position))
    return { assembly: toAssembly(row), options: options.map(toOption) }
  }

  return {
    async create(input, now) {
      const id = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(assemblies)
          .values({
            kind: input.kind,
            subjectRef: input.subjectRef,
            dedupeKey: input.dedupeKey,
            status: 'scheduled',
            opensAt: input.opensAt,
            snapshotAt: input.snapshotAt,
            closesAt: input.closesAt,
            effectAppliesAt: input.effectAppliesAt,
            createdAt: now,
          })
          .onConflictDoNothing({ target: assemblies.dedupeKey })
          .returning({ id: assemblies.id })
        if (!inserted) return null
        await tx.insert(assemblyOptions).values(
          input.options.map((option, position) => ({
            assemblyId: inserted.id,
            key: option.key,
            label: option.label,
            gain: option.gain,
            loss: option.loss,
            effect: option.effect,
            position,
          })),
        )
        return inserted.id
      })
      if (id) return { ...((await load(id)) as AssemblyWithOptions), created: true }
      const [existing] = await db
        .select({ id: assemblies.id })
        .from(assemblies)
        .where(eq(assemblies.dedupeKey, input.dedupeKey))
      return { ...((await load(existing.id)) as AssemblyWithOptions), created: false }
    },
    findById: load,
    async listByStatus(status, limit) {
      const rows = await db
        .select()
        .from(assemblies)
        .where(eq(assemblies.status, status))
        .orderBy(asc(assemblies.closesAt))
        .limit(limit)
      return rows.map(toAssembly)
    },
    async markOpen(id) {
      const rows = await db
        .update(assemblies)
        .set({ status: 'open' })
        .where(and(eq(assemblies.id, id), eq(assemblies.status, 'scheduled')))
        .returning({ id: assemblies.id })
      return rows.length > 0
    },
    async close(id, decision) {
      const rows = await db
        .update(assemblies)
        .set({
          status: 'closed',
          outcome: decision.outcome,
          outcomeReason: decision.reason,
          winningOptionId: decision.winningOptionId,
          voterCount: decision.voterCount,
          decidedAt: decision.decidedAt,
        })
        .where(and(eq(assemblies.id, id), eq(assemblies.status, 'open')))
        .returning({ id: assemblies.id })
      return rows.length > 0
    },
    async upsertVote(input, now) {
      return db.transaction(async (tx) => {
        // Trava a assembleia: o fechamento e o voto se serializam, então um voto não entra depois
        // de a apuração ler os votos.
        const [row] = await tx
          .select({
            status: assemblies.status,
            opensAt: assemblies.opensAt,
            closesAt: assemblies.closesAt,
          })
          .from(assemblies)
          .where(eq(assemblies.id, input.assemblyId))
          .for('update')
        if (!row || row.status !== 'open' || now < row.opensAt || now >= row.closesAt) return false
        await tx
          .insert(assemblyVotes)
          .values({ ...input, createdAt: now, updatedAt: now })
          .onConflictDoUpdate({
            target: [assemblyVotes.assemblyId, assemblyVotes.userId],
            set: { optionId: input.optionId, updatedAt: now },
          })
        return true
      })
    },
    async listVotes(assemblyId) {
      return db.select().from(assemblyVotes).where(eq(assemblyVotes.assemblyId, assemblyId))
    },
    async countCreditsUsed(userId, monthKey) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(assemblyVoteCredits)
        .where(
          and(eq(assemblyVoteCredits.userId, userId), eq(assemblyVoteCredits.monthKey, monthKey)),
        )
      return total
    },
    async consumeCredit(input, now) {
      await db
        .insert(assemblyVoteCredits)
        .values({ ...input, consumedAt: now })
        .onConflictDoNothing()
    },
  }
}
