import {
  CompanyNotFoundError,
  ProposalDeniedError,
  ProposalNotFoundError,
} from '../../domain/errors'
import {
  isProposalLive,
  proposalDenialMessage,
  resolveProposalAccess,
  type AgendaProposal,
  type ProposalParams,
} from '../../domain/proposals'
import type { CompanyStandingReader } from '../ports/companyStandingReader'
import type { ProGate } from '../ports/proGate'
import type { ProposalRepository } from '../ports/proposalRepository'

export interface SupportProposalOutcome {
  proposal: AgendaProposal
  // Já apoiava: nada mudou (apoiar de novo não duplica).
  alreadySupported: boolean
}

// PRO com ações da empresa apoia a proposta de outra pessoa. Um apoio por pessoa. A posição
// vale a de agora e a empresa em período de espera não recebe apoio novo.
export class SupportProposalUseCase {
  constructor(
    private readonly pro: ProGate,
    private readonly standings: CompanyStandingReader,
    private readonly repository: ProposalRepository,
    private readonly params: () => ProposalParams,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { proposalId: string; userId: string }): Promise<SupportProposalOutcome> {
    await this.pro.assertPro(input.userId)
    const params = this.params()
    const now = this.now()

    const proposal = await this.repository.findById(input.proposalId, input.userId)
    if (!proposal) throw new ProposalNotFoundError()
    if (!isProposalLive(proposal, now)) {
      throw new ProposalDeniedError(
        'proposal_not_active',
        proposalDenialMessage('proposal_not_active', params),
      )
    }
    const standing = await this.standings.get(proposal.subjectRef, input.userId)
    if (!standing) throw new CompanyNotFoundError()
    const denial = resolveProposalAccess(standing)
    if (denial) {
      throw new ProposalDeniedError(
        denial,
        proposalDenialMessage(denial, params, standing.cooldownDaysLeft),
      )
    }

    const added = await this.repository.addSupport(proposal.id, input.userId, now)
    if (added === 'not_active') {
      throw new ProposalDeniedError(
        'proposal_not_active',
        proposalDenialMessage('proposal_not_active', params),
      )
    }
    const updated = await this.repository.findById(proposal.id, input.userId)
    return { proposal: updated ?? proposal, alreadySupported: added === 'already' }
  }
}
