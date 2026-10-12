import type { AgendaOption, Assembly } from '../../domain/assembly'
import { AssemblyNotFoundError } from '../../domain/errors'
import { readEffectPreview, readEffectPreviews, type EffectPreview } from '../../domain/scoreboard'
import { holdsDividend } from './listAssemblies'
import type { AssemblyKindRegistry } from '../assemblyKinds'
import type { AssemblyPauseReader } from '../ports/assemblyPauseRepository'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { HoldingsSnapshotProvider } from '../ports/holdingsSnapshotProvider'
import { isPaused } from '../../domain/pause'

// Visão do painel (MO.6.8): todos os estados, inclusive a assembleia ainda `scheduled`.
export interface AdminAssemblyRow {
  id: string
  kind: string
  subjectRef: string
  subjectLabel: string | null
  title: string | null
  status: Assembly['status']
  opensAt: Date
  closesAt: Date
  effectAppliesAt: Date
  effectAppliedAt: Date | null
  outcome: Assembly['outcome']
  outcomeReason: Assembly['outcomeReason']
  voterCount: number | null
  winningOptionId: string | null
  minVoters: number | null
  // Aprovada, com o efeito já devido e ainda não entregue: espera a retomada se há pausa vigente.
  effectPending: boolean
  paused: boolean
  // Assembleia de destinação do lucro (MO.6.13): a declaração de dividendo que ela libera e se o
  // dividendo ainda está retido por ela.
  declarationId: string | null
  dividendOnHold: boolean
}

function toRow(a: Assembly, now: Date, paused: boolean): AdminAssemblyRow {
  return {
    id: a.id,
    kind: a.kind,
    subjectRef: a.subjectRef,
    subjectLabel: a.subjectLabel,
    title: a.title,
    status: a.status,
    opensAt: a.opensAt,
    closesAt: a.closesAt,
    effectAppliesAt: a.effectAppliesAt,
    effectAppliedAt: a.effectAppliedAt,
    outcome: a.outcome,
    outcomeReason: a.outcomeReason,
    voterCount: a.voterCount,
    winningOptionId: a.winningOptionId,
    minVoters: a.minVoters,
    effectPending:
      a.status === 'closed' &&
      a.outcome === 'approved' &&
      a.effectAppliedAt === null &&
      a.effectAppliesAt <= now,
    paused,
    declarationId: a.declarationId,
    dividendOnHold: holdsDividend(a),
  }
}

const LIST_LIMIT = 100

export class ListAdminAssembliesUseCase {
  constructor(
    private readonly repository: AssemblyRepository,
    private readonly pauses: AssemblyPauseReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(status?: Assembly['status']): Promise<AdminAssemblyRow[]> {
    const statuses: Assembly['status'][] = status ? [status] : ['scheduled', 'open', 'closed']
    const [lists, active] = await Promise.all([
      Promise.all(statuses.map((s) => this.repository.listByStatus(s, LIST_LIMIT))),
      this.pauses.listActive(),
    ])
    const now = this.now()
    return lists
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, LIST_LIMIT)
      .map((a) => toRow(a, now, isPaused(active, a.kind, a.subjectRef)))
  }
}

export interface AdminAssemblyVote {
  userId: string
  optionId: string
  // Ações na data de corte (peso do voto); nulo se a pessoa não era elegível (voto descartado).
  weight: number | null
  eligible: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AdminAssemblyDetail {
  assembly: AdminAssemblyRow
  options: Array<{
    id: string
    key: string
    label: string
    gain: string
    loss: string
    effect: EffectPreview | null
    effects: EffectPreview[]
    position: number
    voters: number
    weight: number
  }>
  // Quórum que vale para esta assembleia (o da abertura, ou o de agora se anterior ao parâmetro).
  minVoters: number
  countedVoters: number
  // Quantas pessoas tinham posição na data de corte.
  holders: number
  votes: AdminAssemblyVote[]
}

// Detalhe com voto por pessoa. Exceção deliberada do painel (como o patrimônio): o admin vê quem
// votou em quê; a leitura não é auditada. O público nunca recebe isto (RNF09).
export class GetAdminAssemblyDetailUseCase {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly snapshots: HoldingsSnapshotProvider,
    private readonly pauses: AssemblyPauseReader,
    private readonly currentMinVoters: () => number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(assemblyId: string): Promise<AdminAssemblyDetail> {
    const found = await this.repository.findById(assemblyId)
    if (!found) throw new AssemblyNotFoundError()
    const { assembly, options } = found
    const { policies } = this.kinds.get(assembly.kind)
    // Assembleia ainda `scheduled` não tem snapshot nem voto.
    const scheduled = assembly.status === 'scheduled'
    const [votes, snapshot, active] = await Promise.all([
      scheduled ? [] : this.repository.listVotes(assemblyId),
      scheduled ? { takenAt: assembly.snapshotAt, holdings: [] } : this.snapshots.get(assembly),
      this.pauses.listActive(),
    ])

    const totals = new Map(options.map((o) => [o.id, { voters: 0, weight: 0 }]))
    const rows: AdminAssemblyVote[] = votes.map((vote) => {
      const eligible =
        policies.isEligible(vote.userId, snapshot) && policies.weightOf(vote.userId, snapshot) > 0
      const weight = eligible ? policies.weightOf(vote.userId, snapshot) : null
      const total = totals.get(vote.optionId)
      if (eligible && total && weight !== null) {
        total.voters += 1
        total.weight += weight
      }
      return {
        userId: vote.userId,
        optionId: vote.optionId,
        weight,
        eligible,
        createdAt: vote.createdAt,
        updatedAt: vote.updatedAt,
      }
    })
    return {
      assembly: toRow(assembly, this.now(), isPaused(active, assembly.kind, assembly.subjectRef)),
      options: options.map((o: AgendaOption) => ({
        id: o.id,
        key: o.key,
        label: o.label,
        gain: o.gain,
        loss: o.loss,
        effect: readEffectPreview(o.effect),
        effects: readEffectPreviews(o.effect),
        position: o.position,
        voters: totals.get(o.id)?.voters ?? 0,
        weight: totals.get(o.id)?.weight ?? 0,
      })),
      minVoters: assembly.minVoters ?? this.currentMinVoters(),
      countedVoters: rows.filter((r) => r.eligible).length,
      holders: snapshot.holdings.length,
      votes: rows,
    }
  }
}
