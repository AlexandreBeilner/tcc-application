import type { DeliverPendingEmailsUseCase } from '../../application/useCases/deliverPendingEmails'
import type { PurgeOldEmailsUseCase } from '../../application/useCases/purgeOldEmails'

// A retenção (EM.8.1) anda junto do worker, mas só uma vez por hora: limpar não tem pressa.
export const PURGE_INTERVAL_MS = 60 * 60_000

// Agendamento do worker do outbox: infra de tempo, nunca a regra (isso é
// `DeliverPendingEmailsUseCase`). Mesmo espírito de `startRankingSnapshotScheduler`: roda uma vez
// na subida e depois a cada `intervalMs` (curto, na casa dos segundos: recuperação de senha é
// sensível a tempo); um ciclo ainda em andamento nunca é sobreposto por outro, e uma falha
// isolada é logada sem derrubar o processo. Só loga quando houve trabalho.
export function startEmailOutboxScheduler(
  deliverPendingEmails: DeliverPendingEmailsUseCase,
  intervalMs: number,
  purgeOldEmails?: PurgeOldEmailsUseCase,
): NodeJS.Timeout {
  let running = false
  let lastPurgeAt = Number.NEGATIVE_INFINITY
  const attempt = async () => {
    if (running) return
    running = true
    try {
      const result = await deliverPendingEmails.execute()
      if (result.claimed > 0 || result.recovered > 0) {
        console.log(
          `e-mail: ${result.sent} enviado(s), ${result.retried} reagendado(s), ${result.failed} falha(s), ${result.suppressed} suprimido(s), ${result.recovered} recuperado(s)`,
        )
      }
    } catch (err) {
      console.error('e-mail: erro ao processar o outbox', err)
    }
    // Falha da limpeza nunca atrapalha a entrega (e vice-versa): cada uma tem o seu try.
    if (purgeOldEmails && Date.now() - lastPurgeAt >= PURGE_INTERVAL_MS) {
      lastPurgeAt = Date.now()
      try {
        const { scrubbed } = await purgeOldEmails.execute()
        if (scrubbed > 0) console.log(`e-mail: ${scrubbed} linha(s) antiga(s) do outbox limpa(s)`)
      } catch (err) {
        console.error('e-mail: erro ao limpar o outbox antigo', err)
      }
    }
    running = false
  }

  void attempt()
  return setInterval(() => void attempt(), intervalMs)
}
