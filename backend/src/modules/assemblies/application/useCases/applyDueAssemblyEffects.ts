import type { AssemblyKindRegistry } from '../assemblyKinds'
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
export class ApplyDueAssemblyEffectsUseCase {
  constructor(
    private readonly kinds: AssemblyKindRegistry,
    private readonly repository: AssemblyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<ApplyDueResult> {
    const now = this.now()
    const pending = await this.repository.listApprovedPendingEffect(now, BATCH)
    const result: ApplyDueResult = { applied: 0, failed: 0 }
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
