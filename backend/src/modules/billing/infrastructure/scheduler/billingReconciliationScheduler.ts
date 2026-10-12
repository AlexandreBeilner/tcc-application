import { recordJobFailure, recordJobSuccess, registerJob } from '../../../../infra/jobHealth'
import type { ReconcileSubscriptionsUseCase } from '../../application/useCases/reconcileSubscriptions'

// Agendamento da reconciliação: infra de tempo, a regra é `ReconcileSubscriptionsUseCase`. Mesmo
// desenho do job do ranking: roda na subida e depois a cada `intervalMs`, nunca sobrepõe uma
// execução em andamento, e uma falha isolada é logada sem derrubar o processo.
export function startBillingReconciliationScheduler(
  reconcile: ReconcileSubscriptionsUseCase,
  intervalMs: number,
): NodeJS.Timeout {
  registerJob('billing-reconciliation', intervalMs)
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const { checked, failed } = await reconcile.execute()
      if (checked > 0) {
        console.log(`cobrança: reconciliação conferiu ${checked} assinatura(s), ${failed} falha(s)`)
      }
      recordJobSuccess('billing-reconciliation')
    } catch (err) {
      recordJobFailure('billing-reconciliation')
      console.error('cobrança: erro na reconciliação', err)
    } finally {
      running = false
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
