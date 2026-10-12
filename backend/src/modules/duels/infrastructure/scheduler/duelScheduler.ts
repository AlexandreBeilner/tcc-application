import { recordJobFailure, recordJobSuccess, registerJob } from '../../../../infra/jobHealth'
import type { SettleDueDuelsUseCase } from '../../application/useCases/settleDueDuels'

// Agendamento do job dos duelos: infra de tempo, nunca a regra (isso é `SettleDueDuelsUseCase`).
// Mesmo espírito do job do ranking: roda uma vez na subida (recupera o que venceu com o
// processo parado) e depois a cada `intervalMs`, sem sobrepor execuções.
export function startDuelScheduler(
  settle: Pick<SettleDueDuelsUseCase, 'execute'>,
  intervalMs: number,
): NodeJS.Timeout {
  registerJob('duels', intervalMs)
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const result = await settle.execute()
      if (result.finished + result.expired + result.xpGranted + result.failed > 0) {
        console.log(
          `duelos: ${result.finished} encerrado(s), ${result.expired} desafio(s) expirado(s), XP para ${result.xpGranted}, ${result.failed} falha(s)`,
        )
      }
      recordJobSuccess('duels')
    } catch (err) {
      recordJobFailure('duels')
      console.error('duelos: erro ao encerrar duelos', err)
    } finally {
      running = false
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
