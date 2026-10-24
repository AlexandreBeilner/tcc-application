import { CompanyNotFoundError } from '../../domain/errors'
import type { AgendaTemplate } from '../../domain/lifecycle'
import {
  isTemplateAvailable,
  proposalMonthRange,
  rankProposals,
  resolveProposalAccess,
  type AgendaProposal,
  type ProposalDenial,
  type ProposalParams,
} from '../../domain/proposals'
import { SHAREHOLDER_KIND } from '../../domain/shareholderPolicies'
import type { AgendaCatalog } from '../ports/agendaCatalog'
import type { CompanyStandingReader } from '../ports/companyStandingReader'
import type { ProposalRepository } from '../ports/proposalRepository'

export interface ProposalView {
  id: string
  templateKey: string
  title: string
  description: string
  options: Array<{ label: string; gain: string; loss: string }>
  supportCount: number
  supportedByMe: boolean
  proposedByMe: boolean
  expiresAt: Date
  // Posição na fila (1 = a próxima a ser escolhida); nulo se ainda não tem o mínimo de apoios.
  queuePosition: number | null
}

export interface CompanyProposals {
  company: { id: string; name: string; sector: string }
  holdsShares: boolean
  cooldownDaysLeft: number
  // Por que a pessoa não pode propor ou apoiar agora (ou `null`).
  blockedReason: ProposalDenial | null
  limits: { monthlyCap: number; usedThisMonth: number; minSupport: number; ttlDays: number }
  proposals: ProposalView[]
  // Pautas do catálogo que valem para a empresa, para a tela de "propor".
  availableTemplates: Array<{
    key: string
    title: string
    description: string
    hasActiveProposal: boolean
  }>
}

// Leitura da fila de propostas de uma empresa, com tudo que a tela da 6.6 precisa para decidir
// sem repetir regra no frontend. Visível a qualquer pessoa logada (a pauta é pública); nunca
// revela quem propôs ou apoiou, só a contagem e o que é da própria pessoa.
export class ListCompanyProposalsUseCase {
  constructor(
    private readonly standings: CompanyStandingReader,
    private readonly catalog: AgendaCatalog,
    private readonly repository: ProposalRepository,
    private readonly params: () => ProposalParams,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: { companyId: string; userId: string }): Promise<CompanyProposals> {
    const params = this.params()
    const now = this.now()
    const standing = await this.standings.get(input.companyId, input.userId)
    if (!standing) throw new CompanyNotFoundError()
    const month = proposalMonthRange(now)
    const [templates, proposals, usedThisMonth] = await Promise.all([
      this.catalog.listActive(SHAREHOLDER_KIND),
      this.repository.listActive(SHAREHOLDER_KIND, input.companyId, now, input.userId),
      this.repository.countProposedBy(input.userId, month.from, month.to),
    ])
    const byKey = new Map(templates.map((t) => [t.key, t]))
    const queue = rankProposals(proposals, now, params)
    const view = (p: AgendaProposal): ProposalView | null => {
      const template: AgendaTemplate | undefined = byKey.get(p.templateKey)
      if (!template) return null
      const position = queue.findIndex((q) => q.id === p.id)
      return {
        id: p.id,
        templateKey: p.templateKey,
        title: template.title,
        description: template.description,
        options: template.options.map((o) => ({ label: o.label, gain: o.gain, loss: o.loss })),
        supportCount: p.supportCount,
        supportedByMe: p.supportedByMe,
        proposedByMe: p.proposedBy === input.userId,
        expiresAt: p.expiresAt,
        queuePosition: position === -1 ? null : position + 1,
      }
    }
    const ordered = [...proposals].sort(
      (a, b) =>
        b.supportCount - a.supportCount ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    const activeKeys = new Set(proposals.map((p) => p.templateKey))
    return {
      company: { id: standing.companyId, name: standing.name, sector: standing.sector },
      holdsShares: standing.holdsShares,
      cooldownDaysLeft: standing.cooldownDaysLeft,
      blockedReason: resolveProposalAccess(standing),
      limits: {
        monthlyCap: params.monthlyCap,
        usedThisMonth,
        minSupport: params.minSupport,
        ttlDays: params.ttlDays,
      },
      proposals: ordered.map(view).filter((v): v is ProposalView => v !== null),
      availableTemplates: templates
        .filter((t) => isTemplateAvailable(t, SHAREHOLDER_KIND, standing.sector))
        .map((t) => ({
          key: t.key,
          title: t.title,
          description: t.description,
          hasActiveProposal: activeKeys.has(t.key),
        })),
    }
  }
}
