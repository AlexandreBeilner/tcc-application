import { and, asc, between, desc, eq, isNull, lte, ne, or, sql } from 'drizzle-orm'
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
    title: row.title,
    subjectLabel: row.subjectLabel,
    templateKey: row.templateKey,
    effectAppliedAt: row.effectAppliedAt,
    resultAnnouncedAt: row.resultAnnouncedAt,
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
            title: input.title ?? null,
            subjectLabel: input.subjectLabel ?? null,
            templateKey: input.templateKey ?? null,
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
    async listPublic({ status, subjectRef, limit }) {
      const rows = await db
        .select()
        .from(assemblies)
        .where(
          and(
            eq(assemblies.status, status),
            subjectRef ? eq(assemblies.subjectRef, subjectRef) : undefined,
          ),
        )
        .orderBy(status === 'open' ? asc(assemblies.closesAt) : desc(assemblies.closesAt))
        .limit(limit)
      return rows.map(toAssembly)
    },
    async listOpenDue(now, limit) {
      const rows = await db
        .select()
        .from(assemblies)
        .where(and(eq(assemblies.status, 'open'), lte(assemblies.closesAt, now)))
        .orderBy(asc(assemblies.closesAt))
        .limit(limit)
      return rows.map(toAssembly)
    },
    async listForCalendar(from, to) {
      const rows = await db
        .select()
        .from(assemblies)
        .where(
          and(
            ne(assemblies.status, 'scheduled'),
            or(
              between(assemblies.opensAt, from, to),
              between(assemblies.closesAt, from, to),
              between(assemblies.effectAppliesAt, from, to),
            ),
          ),
        )
        .orderBy(asc(assemblies.opensAt))
      return rows.map(toAssembly)
    },
    async listApprovedPendingEffect(now, limit) {
      const rows = await db
        .select({ id: assemblies.id })
        .from(assemblies)
        .where(
          and(
            eq(assemblies.status, 'closed'),
            eq(assemblies.outcome, 'approved'),
            isNull(assemblies.effectAppliedAt),
            lte(assemblies.effectAppliesAt, now),
          ),
        )
        .orderBy(asc(assemblies.effectAppliesAt))
        .limit(limit)
      const loaded = await Promise.all(rows.map((r) => load(r.id)))
      return loaded.filter((l): l is AssemblyWithOptions => l !== null)
    },
    async listClosedUnannounced(limit) {
      const rows = await db
        .select()
        .from(assemblies)
        .where(and(eq(assemblies.status, 'closed'), isNull(assemblies.resultAnnouncedAt)))
        .orderBy(asc(assemblies.decidedAt))
        .limit(limit)
      return rows.map(toAssembly)
    },
    async markResultAnnounced(id, now) {
      const rows = await db
        .update(assemblies)
        .set({ resultAnnouncedAt: now })
        .where(and(eq(assemblies.id, id), isNull(assemblies.resultAnnouncedAt)))
        .returning({ id: assemblies.id })
      return rows.length > 0
    },
    async countVotedAssemblies(userId) {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(assemblyVotes)
        .where(eq(assemblyVotes.userId, userId))
      return row?.total ?? 0
    },
    async markEffectApplied(id, now) {
      const rows = await db
        .update(assemblies)
        .set({ effectAppliedAt: now })
        .where(and(eq(assemblies.id, id), isNull(assemblies.effectAppliedAt)))
        .returning({ id: assemblies.id })
      return rows.length > 0
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
    async findVote(assemblyId, userId) {
      const [row] = await db
        .select()
        .from(assemblyVotes)
        .where(and(eq(assemblyVotes.assemblyId, assemblyId), eq(assemblyVotes.userId, userId)))
      return row ?? null
    },
    async castVote(input, now) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select({
            status: assemblies.status,
            opensAt: assemblies.opensAt,
            closesAt: assemblies.closesAt,
          })
          .from(assemblies)
          .where(eq(assemblies.id, input.assemblyId))
          .for('update')
        if (!row || row.status !== 'open' || now < row.opensAt || now >= row.closesAt) {
          return { status: 'closed' as const }
        }
        const [current] = await tx
          .select({ userId: assemblyVotes.userId })
          .from(assemblyVotes)
          .where(
            and(
              eq(assemblyVotes.assemblyId, input.assemblyId),
              eq(assemblyVotes.userId, input.userId),
            ),
          )
        const needsCredit = !current && input.credit !== undefined
        if (needsCredit && input.credit) {
          // Serializa os votos da mesma pessoa no mês: o saldo é lido e gasto sem corrida.
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${`assembly-credit:${input.userId}:${input.credit.monthKey}`}))`,
          )
          const [{ total }] = await tx
            .select({ total: sql<number>`count(*)::int` })
            .from(assemblyVoteCredits)
            .where(
              and(
                eq(assemblyVoteCredits.userId, input.userId),
                eq(assemblyVoteCredits.monthKey, input.credit.monthKey),
              ),
            )
          if (total >= input.credit.monthlyFreeCredits) return { status: 'no_credit' as const }
          await tx
            .insert(assemblyVoteCredits)
            .values({
              userId: input.userId,
              assemblyId: input.assemblyId,
              monthKey: input.credit.monthKey,
              consumedAt: now,
            })
            .onConflictDoNothing()
        }
        await tx
          .insert(assemblyVotes)
          .values({
            assemblyId: input.assemblyId,
            userId: input.userId,
            optionId: input.optionId,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [assemblyVotes.assemblyId, assemblyVotes.userId],
            set: { optionId: input.optionId, updatedAt: now },
          })
        return { status: 'cast' as const, changed: Boolean(current), creditConsumed: needsCredit }
      })
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
