import type { ProposalRepository } from '../../application/ports/proposalRepository'
import type { AgendaProposal } from '../../domain/proposals'

export interface FakeProposalRepository extends ProposalRepository {
  proposals: AgendaProposal[]
  supports: Map<string, Set<string>>
  consumed: Array<{ proposalId: string; assemblyId: string }>
  view(proposal: AgendaProposal, viewerId?: string): AgendaProposal
}

// Espelha as regras do adapter Drizzle em memória (duplicado vira existente, teto por mês,
// apoio só em proposta ativa e dentro do prazo) para os testes dos casos de uso.
export function createFakeProposalRepository(): FakeProposalRepository {
  let seq = 0
  const nextId = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`
  const fake: FakeProposalRepository = {
    proposals: [],
    supports: new Map(),
    consumed: [],
    view(p, viewerId) {
      return {
        ...p,
        supportCount: fake.supports.get(p.id)?.size ?? 0,
        supportedByMe: viewerId ? (fake.supports.get(p.id)?.has(viewerId) ?? false) : false,
      }
    },
    async propose(input) {
      const same = fake.proposals.find(
        (p) =>
          p.kind === input.kind &&
          p.subjectRef === input.subjectRef &&
          p.templateKey === input.templateKey &&
          p.status === 'active',
      )
      if (same && same.expiresAt <= input.now) same.status = 'expired'
      else if (same) return { status: 'existing', proposal: fake.view(same) }
      const used = fake.proposals.filter(
        (p) =>
          p.proposedBy === input.userId &&
          p.createdAt >= input.monthFrom &&
          p.createdAt < input.monthTo,
      ).length
      if (used >= input.monthlyCap) return { status: 'cap_reached' }
      const proposal: AgendaProposal = {
        id: nextId(),
        kind: input.kind,
        subjectRef: input.subjectRef,
        templateKey: input.templateKey,
        proposedBy: input.userId,
        status: 'active',
        createdAt: input.now,
        expiresAt: input.expiresAt,
        supportCount: 0,
        supportedByMe: false,
      }
      fake.proposals.push(proposal)
      fake.supports.set(proposal.id, new Set([input.userId]))
      return { status: 'created', proposal: fake.view(proposal, input.userId) }
    },
    async findById(id, viewerId) {
      const p = fake.proposals.find((x) => x.id === id)
      return p ? fake.view(p, viewerId) : null
    },
    async addSupport(proposalId, userId, now) {
      const p = fake.proposals.find((x) => x.id === proposalId)
      if (!p || p.status !== 'active' || p.expiresAt <= now) return 'not_active'
      const set = fake.supports.get(proposalId) ?? new Set<string>()
      fake.supports.set(proposalId, set)
      if (set.has(userId)) return 'already'
      set.add(userId)
      return 'added'
    },
    async removeSupport(proposalId, userId) {
      return fake.supports.get(proposalId)?.delete(userId) ?? false
    },
    async listActive(kind, subjectRef, now, viewerId) {
      return fake.proposals
        .filter(
          (p) =>
            p.kind === kind &&
            p.subjectRef === subjectRef &&
            p.status === 'active' &&
            p.expiresAt > now,
        )
        .map((p) => fake.view(p, viewerId))
    },
    async countProposedBy(userId, from, to) {
      return fake.proposals.filter(
        (p) => p.proposedBy === userId && p.createdAt >= from && p.createdAt < to,
      ).length
    },
    async consumeActive(kind, subjectRef, templateKey, assemblyId) {
      const p = fake.proposals.find(
        (x) =>
          x.kind === kind &&
          x.subjectRef === subjectRef &&
          x.templateKey === templateKey &&
          x.status === 'active',
      )
      if (!p) return false
      p.status = 'consumed'
      fake.consumed.push({ proposalId: p.id, assemblyId })
      return true
    },
    async expireDue(now) {
      let n = 0
      for (const p of fake.proposals) {
        if (p.status === 'active' && p.expiresAt <= now) {
          p.status = 'expired'
          n += 1
        }
      }
      return n
    },
  }
  return fake
}
