import { EmailSendError } from '../../domain/errors'
import { MAX_DELIVERY_ATTEMPTS, nextRetryDelayMs } from '../../domain/retryPolicy'
import { isOptionalCategory, type OutboxEmail } from '../../domain/emailMessage'
import { isBlockedBySuppression } from '../../domain/suppression'
import { sensitivePayloadFields } from '../../domain/templates/registry'
import type { EmailOutboxRepository } from '../ports/emailOutboxRepository'
import type { EmailPreferencesRepository } from '../ports/emailPreferencesRepository'
import type { EmailRenderer } from '../ports/emailRenderer'
import type { EmailSender } from '../ports/emailSender'
import type { EmailSuppressionRepository } from '../ports/emailSuppressionRepository'

export interface DeliverPendingEmailsOptions {
  batchSize: number
  // Linha `sending` mais velha que isso é considerada de um processo que caiu.
  stuckAfterMs: number
  // Espaço mínimo entre envios, pra respeitar o limite de requisições por segundo do provedor
  // (EM.1.2 liga isso a `EMAIL_SEND_RPS`).
  delayBetweenSendsMs: number
}

export interface DeliverPendingEmailsResult {
  claimed: number
  sent: number
  retried: number
  failed: number
  suppressed: number
  recovered: number
}

export const DEFAULT_DELIVER_OPTIONS: DeliverPendingEmailsOptions = {
  batchSize: 20,
  stuckAfterMs: 10 * 60_000,
  delayBetweenSendsMs: 0,
}

// Worker do outbox. Um ciclo: devolve linhas presas, reivindica um lote, renderiza e envia cada
// uma. Erro permanente (ou tentativas esgotadas) => `failed`; erro transitório => reagenda com
// backoff. Nenhuma exceção de uma linha impede as seguintes.
export class DeliverPendingEmailsUseCase {
  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly suppressions: EmailSuppressionRepository,
    private readonly preferences: EmailPreferencesRepository,
    private readonly renderer: EmailRenderer,
    private readonly sender: EmailSender,
    private readonly options: DeliverPendingEmailsOptions = DEFAULT_DELIVER_OPTIONS,
    private readonly now: () => Date = () => new Date(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async execute(): Promise<DeliverPendingEmailsResult> {
    const startedAt = this.now()
    const recovered = await this.outbox.recoverStuck(
      new Date(startedAt.getTime() - this.options.stuckAfterMs),
      MAX_DELIVERY_ATTEMPTS,
    )
    const batch = await this.outbox.claimBatch(this.options.batchSize, startedAt)

    const result: DeliverPendingEmailsResult = {
      claimed: batch.length,
      sent: 0,
      retried: 0,
      failed: 0,
      suppressed: 0,
      recovered,
    }
    for (const [index, email] of batch.entries()) {
      if (index > 0 && this.options.delayBetweenSendsMs > 0) {
        await this.sleep(this.options.delayBetweenSendsMs)
      }
      const outcome = await this.deliverOne(email)
      result[outcome] += 1
    }
    return result
  }

  private async deliverOne(
    email: OutboxEmail,
  ): Promise<'sent' | 'retried' | 'failed' | 'suppressed'> {
    // Um bounce pode ter chegado depois que a linha entrou na fila: confere de novo antes de enviar.
    const reason = await this.suppressions.find(email.toAddress)
    if (reason && isBlockedBySuppression(reason, email.category)) {
      await this.outbox.markSuppressed(email.id, reason)
      return 'suppressed'
    }

    // Quem cancelou a categoria depois que o e-mail entrou na fila (ex.: lote já agendado) não
    // recebe: o cancelamento vale na hora, não só para os próximos.
    if (isOptionalCategory(email.category) && email.userId) {
      const preferences = await this.preferences.get(email.userId)
      if (!preferences[email.category]) {
        await this.outbox.markSuppressed(email.id, 'unsubscribed')
        return 'suppressed'
      }
    }

    // O link de cancelar carrega um token que desliga a categoria: não fica no banco depois
    // que a linha fecha.
    const scrub = isOptionalCategory(email.category)
      ? [...sensitivePayloadFields(email.templateKey), 'unsubscribeUrl']
      : sensitivePayloadFields(email.templateKey)
    let rendered
    try {
      rendered = this.renderer.render(email.templateKey, email.payload)
    } catch (err) {
      // Template inexistente ou payload quebrado não melhora com o tempo.
      await this.outbox.markFailed(email.id, `render: ${describe(err)}`, scrub)
      return 'failed'
    }

    try {
      const { providerMessageId } = await this.sender.send({
        to: email.toAddress,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: rendered.headers,
        idempotencyKey: email.id,
      })
      await this.outbox.markSent(email.id, providerMessageId, this.now(), scrub)
      return 'sent'
    } catch (err) {
      const permanent = err instanceof EmailSendError && err.permanent
      const delayMs = permanent ? null : nextRetryDelayMs(email.attempts)
      if (delayMs === null) {
        await this.outbox.markFailed(email.id, describe(err), scrub)
        return 'failed'
      }
      await this.outbox.markForRetry(
        email.id,
        describe(err),
        new Date(this.now().getTime() + delayMs),
      )
      return 'retried'
    }
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
