import { tallyVotes } from '../../domain/assembly'
import { AssemblyNotFoundError } from '../../domain/errors'
import {
  buildScoreboard,
  readEffectPreview,
  type EffectPreview,
  type Scoreboard,
} from '../../domain/scoreboard'
import type { AssemblyKindRegistry } from '../assemblyKinds'
import type { AgendaCatalog } from '../ports/agendaCatalog'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { HoldingsSnapshotProvider } from '../ports/holdingsSnapshotProvider'
import type { ScoreboardCache } from '../ports/scoreboardCache'
import { toSummary, type AssemblySummary } from './listAssemblies'

export interface AssemblyDetail {
  assembly: AssemblySummary & { description: string | null }
  options: Array<{
    id: string
    key: string
    label: string
    gain: string
    loss: string
    // Sem lado recomendado: só o que a opção mexe e o quanto da faixa do motor ela usa.
    effect: EffectPreview | null
    position: number
  }>
  scoreboard: Scoreboard
  // Presente só depois do fechamento (público a partir daí, antes de o efeito valer).
  result: {
    outcome: NonNullable<AssemblySummary['outcome']>
    reason: NonNullable<AssemblySummary['outcomeReason']>
    winningOptionId: string | null
    voterCount: number
    decidedAt: Date
  } | null
  minVoters: number
}

// Detalhe público: ficha da pauta, placar e resultado. O placar de assembleia aberta passa por um
// cache de poucos segundos; o de uma encerrada é estável e a apuração é barata, então sai direto.
export class GetAssemblyUseCase {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly snapshots: HoldingsSnapshotProvider,
    private readonly catalog: AgendaCatalog,
    private readonly cache: ScoreboardCache,
    private readonly minVoters: () => number,
  ) {}

  async execute(assemblyId: string): Promise<AssemblyDetail> {
    const found = await this.repository.findById(assemblyId)
    // Ainda não aberta não é pública.
    if (!found || found.assembly.status === 'scheduled') throw new AssemblyNotFoundError()
    const { assembly, options } = found

    const scoreboard = await this.scoreboardOf(found)
    const templates = assembly.templateKey ? await this.catalog.listActive(assembly.kind) : []
    const description = templates.find((t) => t.key === assembly.templateKey)?.description ?? null
    const decided = assembly.outcome && assembly.outcomeReason && assembly.decidedAt

    return {
      assembly: { ...toSummary(assembly), description },
      options: options.map((o) => ({
        id: o.id,
        key: o.key,
        label: o.label,
        gain: o.gain,
        loss: o.loss,
        effect: readEffectPreview(o.effect),
        position: o.position,
      })),
      scoreboard,
      result: decided
        ? {
            outcome: assembly.outcome as NonNullable<typeof assembly.outcome>,
            reason: assembly.outcomeReason as NonNullable<typeof assembly.outcomeReason>,
            winningOptionId: assembly.winningOptionId,
            voterCount: assembly.voterCount ?? scoreboard.voters,
            decidedAt: assembly.decidedAt as Date,
          }
        : null,
      minVoters: assembly.minVoters ?? this.minVoters(),
    }
  }

  private async scoreboardOf({
    assembly,
    options,
  }: NonNullable<Awaited<ReturnType<AssemblyRepository['findById']>>>): Promise<Scoreboard> {
    const open = assembly.status === 'open'
    if (open) {
      const cached = await this.cache.get(assembly.id)
      if (cached) return cached
    }
    const { policies } = this.kinds.get(assembly.kind)
    const [votes, snapshot] = await Promise.all([
      this.repository.listVotes(assembly.id),
      this.snapshots.get(assembly),
    ])
    const board = buildScoreboard(tallyVotes(options, votes, snapshot, policies, { minVoters: 0 }))
    if (open) await this.cache.set(assembly.id, board)
    return board
  }
}
