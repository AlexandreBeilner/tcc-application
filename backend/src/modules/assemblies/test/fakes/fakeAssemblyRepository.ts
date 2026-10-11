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
