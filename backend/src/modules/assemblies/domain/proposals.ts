// Propostas de pauta e apoio (MO.6.5): regras puras. Quem tem ações propõe uma pauta do catálogo
// para a empresa; outro acionista apoia; a mais apoiada entra na próxima assembleia da empresa.
// Os valores abaixo são o ponto de partida até a tabela editável do painel (MO.6.8).
import { brtMonthKey } from './assembly'
import type { AgendaTemplate } from './lifecycle'

export interface ProposalParams {
  // Propostas novas que cada pessoa pode criar por mês de calendário (apoiar não gasta).
  monthlyCap: number
  // Apoios mínimos (o proponente conta como o primeiro) para uma proposta poder ser escolhida.
  minSupport: number
  // Por quantos dias reais uma proposta fica na fila antes de expirar.
  ttlDays: number
}

export const DEFAULT_PROPOSAL_PARAMS: ProposalParams = {
  monthlyCap: 3,
  minSupport: 2,
  ttlDays: 30,
}

export type ProposalStatus = 'active' | 'consumed' | 'expired'

export interface AgendaProposal {
  id: string
  kind: string
  subjectRef: string
  templateKey: string
  proposedBy: string
  status: ProposalStatus
  createdAt: Date
  expiresAt: Date
  supportCount: number
  // Só para quem consultou; nunca se revela quem apoiou.
  supportedByMe: boolean
}

export type ProposalDenial =
  | 'not_shareholder'
  | 'company_in_cooldown'
  | 'monthly_cap_reached'
  | 'proposal_not_active'
  | 'template_unavailable'

const DAY_MS = 24 * 60 * 60 * 1000

export function proposalExpiry(now: Date, params: Pick<ProposalParams, 'ttlDays'>): Date {
  return new Date(now.getTime() + params.ttlDays * DAY_MS)
}

// Intervalo [from, to) do mês de calendário de Brasília (o mesmo da chave do crédito de voto).
export function proposalMonthRange(at: Date): { monthKey: string; from: Date; to: Date } {
  const monthKey = brtMonthKey(at)
  const [year, month] = monthKey.split('-').map(Number)
  // Brasília é UTC-3: a meia-noite local é 03:00 UTC.
  return {
    monthKey,
    from: new Date(Date.UTC(year, month - 1, 1, 3)),
    to: new Date(Date.UTC(year, month, 1, 3)),
  }
}

export function isProposalLive(proposal: AgendaProposal, now: Date): boolean {
  return proposal.status === 'active' && proposal.expiresAt > now
}

// A pauta existe no catálogo ativo do kind e vale para o setor da empresa (nulo vale para todos).
export function isTemplateAvailable(
  template: AgendaTemplate | undefined,
  kind: string,
  sector: string,
): template is AgendaTemplate {
  return (
    template !== undefined &&
    template.kind === kind &&
    (template.sector === null || template.sector === sector)
  )
}

// Ordem de escolha: mais apoios primeiro; empate pela proposta mais antiga (id fecha o desempate
// para a ordem nunca depender do banco). Só entram as vivas e com o mínimo de apoios.
export function rankProposals(
  proposals: readonly AgendaProposal[],
  now: Date,
  params: Pick<ProposalParams, 'minSupport'>,
): AgendaProposal[] {
  return proposals
    .filter((p) => isProposalLive(p, now) && p.supportCount >= params.minSupport)
    .sort(
      (a, b) =>
        b.supportCount - a.supportCount ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )
}

// A primeira proposta da fila cuja pauta ainda vale para a empresa (o catálogo pode ter mudado
// desde que ela foi feita). `null` se nenhuma serve: aí vale o sorteio do catálogo.
export function pickProposedTemplate(
  ranked: readonly AgendaProposal[],
  templates: readonly AgendaTemplate[],
  kind: string,
  sector: string,
): { proposal: AgendaProposal; template: AgendaTemplate } | null {
  for (const proposal of ranked) {
    const template = templates.find((t) => t.key === proposal.templateKey)
    if (isTemplateAvailable(template, kind, sector)) return { proposal, template }
  }
  return null
}

export function proposalDenialMessage(
  reason: ProposalDenial,
  params: ProposalParams,
  cooldownDaysLeft = 0,
): string {
  switch (reason) {
    case 'not_shareholder':
      return 'Só quem tem ações da empresa pode propor ou apoiar pautas dela.'
    case 'company_in_cooldown':
      return `A empresa acabou de passar por uma mudança e está em período de espera por mais ${cooldownDaysLeft} ${cooldownDaysLeft === 1 ? 'dia' : 'dias'} do mercado. Dá para propor depois.`
    case 'monthly_cap_reached':
      return `Você já fez as ${params.monthlyCap} propostas deste mês. Elas voltam a ficar disponíveis no mês que vem.`
    case 'proposal_not_active':
      return 'Esta proposta já foi usada ou expirou.'
    case 'template_unavailable':
      return 'Esta pauta não está disponível para esta empresa.'
  }
}

// Quem pode propor e apoiar: acionista de hoje, e só enquanto a empresa não está em período de
// espera depois de uma mudança (o motor registra e ignora decisões nesse período, então a pauta
// nem entra na fila). `null` = pode.
export function resolveProposalAccess(standing: {
  holdsShares: boolean
  cooldownDaysLeft: number
}): ProposalDenial | null {
  if (!standing.holdsShares) return 'not_shareholder'
  if (standing.cooldownDaysLeft > 0) return 'company_in_cooldown'
  return null
}
