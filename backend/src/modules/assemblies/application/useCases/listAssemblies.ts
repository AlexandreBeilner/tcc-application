import type { Assembly } from '../../domain/assembly'
import type { AssemblyRepository } from '../ports/assemblyRepository'

// Resumo público de uma assembleia (lista e Notícias). Nada por pessoa.
export interface AssemblySummary {
  id: string
  kind: string
  subjectRef: string
  subjectLabel: string | null
  title: string | null
  status: 'open' | 'closed'
  opensAt: Date
  closesAt: Date
  effectAppliesAt: Date
  effectAppliedAt: Date | null
  outcome: Assembly['outcome']
  outcomeReason: Assembly['outcomeReason']
  voterCount: number | null
  // O dividendo do balanço desta empresa está retido esperando esta assembleia (destinação do
  // lucro, MO.6.13): aberta, ou aprovada e ainda sem o efeito entregue. Vira `false` quando o
  // dividendo é liberado (fechada sem decisão, ou decisão aplicada).
  dividendOnHold: boolean
}

// A assembleia ligada a uma declaração de dividendo ainda segura o dividendo?
export function holdsDividend(a: Assembly): boolean {
  if (!a.declarationId) return false
  if (a.status !== 'closed') return true
  return a.outcome === 'approved' && a.effectAppliedAt === null
}

export function toSummary(a: Assembly): AssemblySummary {
  return {
    id: a.id,
    kind: a.kind,
    subjectRef: a.subjectRef,
    subjectLabel: a.subjectLabel,
    title: a.title,
    status: a.status === 'open' ? 'open' : 'closed',
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    effectAppliesAt: a.effectAppliesAt,
    effectAppliedAt: a.effectAppliedAt,
    outcome: a.outcome,
    outcomeReason: a.outcomeReason,
    voterCount: a.voterCount,
    dividendOnHold: holdsDividend(a),
  }
}

export interface ListAssembliesInput {
  // Sem filtro devolve as duas listas.
  status?: 'open' | 'closed'
  companyId?: string
  // Teto das encerradas (as abertas são poucas e vêm todas).
  closedLimit: number
}

// Lista pública: abertas (as que fecham primeiro vêm antes) e o histórico recente.
export class ListAssembliesUseCase {
  constructor(private readonly repository: AssemblyRepository) {}

  async execute(
    input: ListAssembliesInput,
  ): Promise<{ open: AssemblySummary[]; closed: AssemblySummary[] }> {
    const subjectRef = input.companyId
    const [open, closed] = await Promise.all([
      input.status === 'closed'
        ? []
        : this.repository.listPublic({ status: 'open', subjectRef, limit: 100 }),
      input.status === 'open'
        ? []
        : this.repository.listPublic({ status: 'closed', subjectRef, limit: input.closedLimit }),
    ])
    return { open: open.map(toSummary), closed: closed.map(toSummary) }
  }
}
