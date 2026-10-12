import { ProposalNotFoundError } from '../../domain/errors'
import type { AgendaProposal } from '../../domain/proposals'
import type { ProposalRepository } from '../ports/proposalRepository'

// Retira o apoio dado (reversível, como trocar o voto). Não pede PRO: quem cancelou o plano
// ainda desfaz o que apoiou. A proposta nunca some por isso, só perde a contagem; o teto do mês
// de quem propôs não é devolvido.
export class WithdrawProposalSupportUseCase {
  constructor(private readonly repository: ProposalRepository) {}

  async execute(input: {
    proposalId: string
    userId: string
  }): Promise<{ proposal: AgendaProposal; withdrawn: boolean }> {
    const before = await this.repository.findById(input.proposalId, input.userId)
    if (!before) throw new ProposalNotFoundError()
    const withdrawn = await this.repository.removeSupport(input.proposalId, input.userId)
    const proposal = (await this.repository.findById(input.proposalId, input.userId)) ?? before
    return { proposal, withdrawn }
  }
}
