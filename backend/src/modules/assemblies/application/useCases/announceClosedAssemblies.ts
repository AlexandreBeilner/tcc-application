import type { AssemblyKindRegistry } from '../assemblyKinds'
import type { AssemblyRepository } from '../ports/assemblyRepository'
import type { HoldingsSnapshotProvider } from '../ports/holdingsSnapshotProvider'
import type { AssemblyResultSummary, ResultFeed, ResultMailer } from '../ports/resultPublishers'

export interface AnnounceResult {
  announced: number
  failed: number
}

const BATCH = 50
const CONCURRENCY = 25

// Publica o resultado das assembleias já fechadas: item no feed social de quem votou e e-mail
// (opt-in) para quem tinha posição na data de corte. Cada envio é idempotente por assembleia e
// pessoa, então se algum falhar a assembleia fica sem a marca e a rodada seguinte repete tudo sem
// duplicar nada. Nada aqui depende de quem venceu: a participação é o que aparece.
export class AnnounceClosedAssembliesUseCase {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly snapshots: HoldingsSnapshotProvider,
    private readonly feed: ResultFeed,
    private readonly mailer: ResultMailer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<AnnounceResult> {
    const closed = await this.repository.listClosedUnannounced(BATCH)
    const result: AnnounceResult = { announced: 0, failed: 0 }
    for (const assembly of closed) {
      try {
        if (await this.announce(assembly.id)) result.announced += 1
      } catch (err) {
        result.failed += 1
        console.error(
          `assembleias: falha ao publicar o resultado da assembleia ${assembly.id}`,
          err,
        )
      }
    }
    return result
  }

  private async announce(assemblyId: string): Promise<boolean> {
    const loaded = await this.repository.findById(assemblyId)
    if (!loaded || loaded.assembly.status !== 'closed' || !loaded.assembly.outcome) return false
    const { assembly, options } = loaded
    const outcome = loaded.assembly.outcome
    const winner = options.find((o) => o.id === assembly.winningOptionId) ?? null
    const summary: AssemblyResultSummary = {
      assemblyId: assembly.id,
      subjectLabel: assembly.subjectLabel ?? 'a empresa',
      title: assembly.title ?? 'Assembleia de acionistas',
      outcome,
      reason: assembly.outcomeReason ?? 'decided',
      winningLabel: winner?.label ?? null,
    }

    const voterIds = [
      ...new Set((await this.repository.listVotes(assembly.id)).map((v) => v.userId)),
    ]
    const { policies } = this.kinds.get(assembly.kind)
    const snapshot = await this.snapshots.get(assembly)
    const holderIds = [
      ...new Set(
        snapshot.holdings
          .filter((h) => policies.isEligible(h.userId, snapshot))
          .map((h) => h.userId),
      ),
    ]

    await inChunks(voterIds, (userId) => this.feed.publishParticipation(userId, summary))
    await inChunks(holderIds, (userId) => this.mailer.sendResult(userId, summary))
    return this.repository.markResultAnnounced(assembly.id, this.now())
  }
}

// Em lotes: uma assembleia com milhares de acionistas não abre milhares de conexões de uma vez. Uma
// falha individual não interrompe os demais; no fim o erro sobe e a assembleia fica sem a marca.
async function inChunks(ids: string[], run: (id: string) => Promise<void>): Promise<void> {
  let failures = 0
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const settled = await Promise.allSettled(ids.slice(i, i + CONCURRENCY).map(run))
    for (const item of settled) {
      if (item.status === 'rejected') {
        failures += 1
        console.error('assembleias: falha ao publicar o resultado para uma pessoa', item.reason)
      }
    }
  }
  if (failures > 0) throw new Error(`${failures} publicação(ões) de resultado falharam`)
}
