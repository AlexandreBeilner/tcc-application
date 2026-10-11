import type {
  AssemblyDecision,
  AssemblyRepository,
  AssemblyWithOptions,
} from '../../application/ports/assemblyRepository'
import type { Vote } from '../../domain/assembly'

export interface FakeAssemblyRepository extends AssemblyRepository {
  items: Map<string, AssemblyWithOptions>
  votes: Vote[]
  credits: Array<{ userId: string; assemblyId: string; monthKey: string }>
}

export function createFakeAssemblyRepository(): FakeAssemblyRepository {
  let seq = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`
  const fake: FakeAssemblyRepository = {
    items: new Map(),
    votes: [],
    credits: [],
    async create(input, now) {
      const existing = [...fake.items.values()].find(
        (i) => i.assembly.dedupeKey === input.dedupeKey,
      )
      if (existing) return { ...existing, created: false }
      const id = nextId()
      const created: AssemblyWithOptions = {
        assembly: {
          id,
          kind: input.kind,
          subjectRef: input.subjectRef,
          dedupeKey: input.dedupeKey,
          status: 'scheduled',
          opensAt: input.opensAt,
          snapshotAt: input.snapshotAt,
          closesAt: input.closesAt,
          effectAppliesAt: input.effectAppliesAt,
          outcome: null,
          outcomeReason: null,
          winningOptionId: null,
          voterCount: null,
          decidedAt: null,
          title: input.title ?? null,
          subjectLabel: input.subjectLabel ?? null,
          templateKey: input.templateKey ?? null,
          effectAppliedAt: null,
          createdAt: now,
        },
        options: input.options.map((o, position) => ({
          ...o,
          id: nextId(),
          assemblyId: id,
          position,
        })),
      }
      fake.items.set(id, created)
      return { ...created, created: true }
    },
    async findById(id) {
      return fake.items.get(id) ?? null
    },
    async listByStatus(status, limit) {
      return [...fake.items.values()]
        .map((i) => i.assembly)
        .filter((a) => a.status === status)
        .slice(0, limit)
    },
    async listPublic({ status, subjectRef, limit }) {
      const sign = status === 'open' ? 1 : -1
      return [...fake.items.values()]
        .map((i) => i.assembly)
        .filter((a) => a.status === status && (!subjectRef || a.subjectRef === subjectRef))
        .sort((a, b) => sign * (a.closesAt.getTime() - b.closesAt.getTime()))
        .slice(0, limit)
    },
    async listOpenDue(now, limit) {
      return [...fake.items.values()]
        .map((i) => i.assembly)
        .filter((a) => a.status === 'open' && a.closesAt <= now)
        .slice(0, limit)
    },
    async listForCalendar(from, to) {
      const within = (d: Date) => d >= from && d <= to
      return [...fake.items.values()]
        .map((i) => i.assembly)
        .filter(
          (a) =>
            a.status !== 'scheduled' &&
            (within(a.opensAt) || within(a.closesAt) || within(a.effectAppliesAt)),
        )
    },
    async listApprovedPendingEffect(now, limit) {
      return [...fake.items.values()]
        .filter(
          (i) =>
            i.assembly.status === 'closed' &&
            i.assembly.outcome === 'approved' &&
            i.assembly.effectAppliedAt === null &&
            i.assembly.effectAppliesAt <= now,
        )
        .slice(0, limit)
    },
    async markEffectApplied(id, now) {
      const item = fake.items.get(id)
      if (!item || item.assembly.effectAppliedAt) return false
      item.assembly.effectAppliedAt = now
      return true
    },
    async markOpen(id) {
      const item = fake.items.get(id)
      if (!item || item.assembly.status !== 'scheduled') return false
      item.assembly.status = 'open'
      return true
    },
    async close(id, decision: AssemblyDecision) {
      const item = fake.items.get(id)
      if (!item || item.assembly.status !== 'open') return false
      Object.assign(item.assembly, {
        status: 'closed',
        outcome: decision.outcome,
        outcomeReason: decision.reason,
        winningOptionId: decision.winningOptionId,
        voterCount: decision.voterCount,
        decidedAt: decision.decidedAt,
      })
      return true
    },
    async upsertVote(input, now) {
      const item = fake.items.get(input.assemblyId)
      if (!item) return false
      const { assembly } = item
      if (assembly.status !== 'open' || now < assembly.opensAt || now >= assembly.closesAt)
        return false
      const current = fake.votes.find(
        (v) => v.assemblyId === input.assemblyId && v.userId === input.userId,
      )
      if (current) {
        current.optionId = input.optionId
        current.updatedAt = now
      } else {
        fake.votes.push({ ...input, createdAt: now, updatedAt: now })
      }
      return true
    },
    async listVotes(assemblyId) {
      return fake.votes.filter((v) => v.assemblyId === assemblyId)
    },
    async findVote(assemblyId, userId) {
      return fake.votes.find((v) => v.assemblyId === assemblyId && v.userId === userId) ?? null
    },
    async castVote(input, now) {
      const item = fake.items.get(input.assemblyId)
      if (!item) return { status: 'closed' }
      const { assembly } = item
      if (assembly.status !== 'open' || now < assembly.opensAt || now >= assembly.closesAt) {
        return { status: 'closed' }
      }
      const current = fake.votes.find(
        (v) => v.assemblyId === input.assemblyId && v.userId === input.userId,
      )
      const needsCredit = !current && input.credit !== undefined
      if (needsCredit && input.credit) {
        const used = fake.credits.filter(
          (c) => c.userId === input.userId && c.monthKey === input.credit?.monthKey,
        ).length
        if (used >= input.credit.monthlyFreeCredits) return { status: 'no_credit' }
      }
      if (current) {
        current.optionId = input.optionId
        current.updatedAt = now
      } else {
        fake.votes.push({
          assemblyId: input.assemblyId,
          userId: input.userId,
          optionId: input.optionId,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (needsCredit && input.credit) {
        fake.credits.push({
          userId: input.userId,
          assemblyId: input.assemblyId,
          monthKey: input.credit.monthKey,
        })
      }
      return { status: 'cast', changed: Boolean(current), creditConsumed: needsCredit }
    },
    async countCreditsUsed(userId, monthKey) {
      return fake.credits.filter((c) => c.userId === userId && c.monthKey === monthKey).length
    },
    async consumeCredit(input) {
      if (
        !fake.credits.some((c) => c.userId === input.userId && c.assemblyId === input.assemblyId)
      ) {
        fake.credits.push(input)
      }
    },
  }
  return fake
}
