import { isPaused } from '../../domain/pause'
import type { AssemblyKindRegistry } from '../assemblyKinds'
import type { AssemblyPauseReader } from '../ports/assemblyPauseRepository'
import type { AssemblyRepository } from '../ports/assemblyRepository'

export interface ApplyDueResult {
  applied: number
  failed: number
}

const BATCH = 100

// Entrega ao motor o resultado das assembleias aprovadas cujo efeito já é devido
// (`effect_applies_at`). O envio é idempotente no motor (por id da assembleia), então se a marcação
// falhar depois do envio a rodada seguinte repete sem dobrar o efeito. Assembleia não aprovada
// nunca chega aqui nem ao motor.
//
// Pausa do painel (MO.6.8): assembleia de empresa pausada (ou qualquer uma, na pausa global) não é
// entregue e fica pendente, sem perder estado; a rodada depois da retomada a entrega.
export class ApplyDueAssemblyEffectsUseCase {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly pauses: AssemblyPauseReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<ApplyDueResult> {
    const now = this.now()
    const paused = await this.pauses.listActive()
    const result: ApplyDueResult = { applied: 0, failed: 0 }
    if (paused.some((p) => p.scope === 'global')) return result
    const pending = (await this.repository.listApprovedPendingEffect(now, BATCH)).filter(
      ({ assembly }) => !isPaused(paused, assembly.kind, assembly.subjectRef),
    )
    for (const { assembly, options } of pending) {
      try {
        const winner = options.find((o) => o.id === assembly.winningOptionId) ?? null
        await this.kinds.get(assembly.kind).effect.apply(assembly, winner)
        if (await this.repository.markEffectApplied(assembly.id, now)) result.applied += 1
      } catch (err) {
        result.failed += 1
        console.error(`assembleias: falha ao aplicar o efeito da assembleia ${assembly.id}`, err)
      }
    }
    return result
  }
}
