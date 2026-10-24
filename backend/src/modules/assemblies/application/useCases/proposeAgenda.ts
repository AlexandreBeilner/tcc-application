import { CompanyNotFoundError, ProposalDeniedError } from '../../domain/errors'
import {
  isTemplateAvailable,
  proposalDenialMessage,
  proposalExpiry,
  proposalMonthRange,
  resolveProposalAccess,
  type AgendaProposal,
  type ProposalParams,
} from '../../domain/proposals'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import type { AgendaCatalog } from '../ports/agendaCatalog'
import type { CompanyStandingReader } from '../ports/companyStandingReader'
import type { ProposalRepository } from '../ports/proposalRepository'

export interface ProposeAgendaInput {
  companyId: string
  templateKey: string
  userId: string
}

export interface ProposeAgendaOutcome {
  proposal: AgendaProposal
  // A pauta já tinha proposta ativa: o pedido virou apoio a ela e não gastou o teto do mês.
  joinedExisting: boolean
}

// Quem tem ações propõe uma pauta do catálogo para a empresa. Sem texto livre: só a chave da
// pauta. Ordem das recusas: empresa (ações e período de espera), pauta, teto do mês. Propor
// uma pauta que já está na fila apoia a existente (o duplicado não divide a contagem).
export class ProposeAgendaUseCase {
  constructor(
    private readonly standings: CompanyStandingReader,
    private readonly catalog: AgendaCatalog,
    private readonly repository: ProposalRepository,
    private readonly params: () => ProposalParams,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: ProposeAgendaInput): Promise<ProposeAgendaOutcome> {
    const params = this.params()
    const now = this.now()

    const standing = await this.standings.get(input.companyId, input.userId)
    if (!standing) throw new CompanyNotFoundError()
    const denial = resolveProposalAccess(standing)
    if (denial) {
      throw new ProposalDeniedError(
        denial,
        proposalDenialMessage(denial, params, standing.cooldownDaysLeft),
      )
    }

    const templates = await this.catalog.listActive(SHAREHOLDER_KIND)
    const template = templates.find((t) => t.key === input.templateKey)
    if (!isTemplateAvailable(template, SHAREHOLDER_KIND, standing.sector)) {
      throw new ProposalDeniedError(
        'template_unavailable',
        proposalDenialMessage('template_unavailable', params),
      )
    }

    const month = proposalMonthRange(now)
    const result = await this.repository.propose({
      kind: SHAREHOLDER_KIND,
      subjectRef: input.companyId,
      templateKey: input.templateKey,
      userId: input.userId,
      now,
      expiresAt: proposalExpiry(now, params),
      monthFrom: month.from,
      monthTo: month.to,
      monthlyCap: params.monthlyCap,
    })
    if (result.status === 'cap_reached') {
      throw new ProposalDeniedError(
        'monthly_cap_reached',
        proposalDenialMessage('monthly_cap_reached', params),
      )
    }
    if (result.status === 'created') return { proposal: result.proposal, joinedExisting: false }

    const added = await this.repository.addSupport(result.proposal.id, input.userId, now)
    if (added === 'not_active') {
      throw new ProposalDeniedError(
        'proposal_not_active',
        proposalDenialMessage('proposal_not_active', params),
      )
    }
    const proposal = await this.repository.findById(result.proposal.id, input.userId)
    return { proposal: proposal ?? result.proposal, joinedExisting: true }
  }
}
