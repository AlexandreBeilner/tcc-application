import type { DeliverPendingEmailsUseCase } from '../../application/useCases/deliverPendingEmails'

// Agendamento do worker do outbox: infra de tempo, nunca a regra (isso é
// `DeliverPendingEmailsUseCase`). Mesmo espírito de `startRankingSnapshotScheduler`: roda uma vez
// na subida e depois a cada `intervalMs` (curto, na casa dos segundos: recuperação de senha é
// sensível a tempo); um ciclo ainda em andamento nunca é sobreposto por outro, e uma falha
// isolada é logada sem derrubar o processo. Só loga quando houve trabalho.
export function startEmailOutboxScheduler(
  deliverPendingEmails: DeliverPendingEmailsUseCase,
  intervalMs: number,
): NodeJS.Timeout {
  let running = false
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const result = await deliverPendingEmails.execute()
      if (result.claimed > 0 || result.recovered > 0) {
        console.log(
          `e-mail: ${result.sent} enviado(s), ${result.retried} reagendado(s), ${result.failed} falha(s), ${result.recovered} recuperado(s)`,
        )
      }
    } catch (err) {
      console.error('e-mail: erro ao processar o outbox', err)
    } finally {
      running = false
    }
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
