import { recordJobFailure, recordJobSuccess, registerJob } from '../../../../infra/jobHealth'
import type { PurgeOldFunnelEventsUseCase } from '../../application/useCases/purgeOldFunnelEvents'

// Agendamento da limpeza de retenção do funil: infra de tempo, a regra é `PurgeOldFunnelEventsUseCase`.
// Roda na subida e depois a cada `intervalMs`; falha isolada é logada sem derrubar o processo.
export function startFunnelRetentionScheduler(
  purge: PurgeOldFunnelEventsUseCase,
  intervalMs: number,
): NodeJS.Timeout {
  registerJob('funnel-retention', intervalMs)
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const removed = await purge.execute()
      if (removed > 0) console.log(`cobrança: ${removed} evento(s) de funil antigos apagados`)
      recordJobSuccess('funnel-retention')
    } catch (err) {
      recordJobFailure('funnel-retention')
      console.error('cobrança: erro ao apagar eventos de funil antigos', err)
    } finally {
      running = false
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
