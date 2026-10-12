import { recordJobFailure, recordJobSuccess, registerJob } from '../../../../infra/jobHealth'
import type { RunAssemblyLifecycleUseCase } from '../../application/useCases/runAssemblyLifecycle'

// Agendamento do ciclo das assembleias: infra de tempo, nunca a regra (isso é
// `RunAssemblyLifecycleUseCase`). Roda uma vez na subida (recupera o que venceu com o processo
// parado) e depois a cada `intervalMs`, sem sobrepor execuções.
export function startAssemblyScheduler(
  run: Pick<RunAssemblyLifecycleUseCase, 'execute'>,
  intervalMs: number,
): NodeJS.Timeout {
  registerJob('assemblies', intervalMs)
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const { open, close, apply } = await run.execute()
      if (
        open.opened + close.closed + apply.applied + open.failed + close.failed + apply.failed >
        0
      ) {
        console.log(
          `assembleias: ${open.opened} aberta(s), ${close.closed} fechada(s) (${close.approved} aprovada(s)), ${apply.applied} efeito(s) aplicado(s), ${open.failed + close.failed + apply.failed} falha(s)`,
        )
      }
      recordJobSuccess('assemblies')
    } catch (err) {
      recordJobFailure('assemblies')
      console.error('assembleias: erro no ciclo', err)
    }
    running = false
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
