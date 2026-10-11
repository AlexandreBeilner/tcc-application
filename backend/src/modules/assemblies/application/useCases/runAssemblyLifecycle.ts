import type { ApplyDueAssemblyEffectsUseCase, ApplyDueResult } from './applyDueAssemblyEffects'
import type { CloseDueAssembliesUseCase, CloseDueResult } from './closeDueAssemblies'
import type { OpenDueAssembliesUseCase, OpenDueResult } from './openDueAssemblies'

export interface LifecycleRunResult {
  open: OpenDueResult
  close: CloseDueResult
  apply: ApplyDueResult
}

// Uma rodada do job: fechar primeiro (libera o que venceu), depois abrir e por fim aplicar. Cada
// etapa é independente: uma falha numa não impede as outras (o erro é do item, não da rodada).
export class RunAssemblyLifecycleUseCase {
  constructor(
    private readonly closeDue: Pick<CloseDueAssembliesUseCase, 'execute'>,
    private readonly openDue: Pick<OpenDueAssembliesUseCase, 'execute'>,
    private readonly applyDue: Pick<ApplyDueAssemblyEffectsUseCase, 'execute'>,
  ) {}

  async execute(): Promise<LifecycleRunResult> {
    const close = await this.closeDue
      .execute()
      .catch(failedStage('fechar', { closed: 0, approved: 0, failed: 1 }))
    const open = await this.openDue.execute().catch(failedStage('abrir', { opened: 0, failed: 1 }))
    const apply = await this.applyDue
      .execute()
      .catch(failedStage('aplicar', { applied: 0, failed: 1 }))
    return { open, close, apply }
  }
}

function failedStage<T>(stage: string, fallback: T) {
  return (err: unknown): T => {
    console.error(`assembleias: etapa "${stage}" falhou`, err)
    return fallback
  }
}
