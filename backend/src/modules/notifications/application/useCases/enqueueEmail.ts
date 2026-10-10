import {
  isOptionalCategory,
  isUndeliverableAddress,
  normalizeAddress,
  type EmailCategory,
  type OptionalEmailCategory,
} from '../../domain/emailMessage'
import { isEligibleForOptionalEmail } from '../../domain/emailPreferences'
import { isBlockedBySuppression, type SuppressionReason } from '../../domain/suppression'
import type { EmailOutboxRepository } from '../ports/emailOutboxRepository'
import type { EmailPreferencesRepository } from '../ports/emailPreferencesRepository'
import type { EmailSuppressionRepository } from '../ports/emailSuppressionRepository'
import type { RecipientDirectory } from '../ports/recipientDirectory'
import type { UnsubscribeLinks } from '../ports/unsubscribeTokens'

export interface EnqueueEmailInput {
  userId: string | null
  to: string
  templateKey: string
  category: EmailCategory
  payload: Record<string, unknown>
  // Chave estável do fato que gera o e-mail (ex.: `password-reset:<tokenId>`): reenfileirar o
  // mesmo fato não envia duas vezes.
  idempotencyKey: string
  sendAt?: Date
}

export type EnqueueEmailResult =
  | { status: 'enqueued'; id: string }
  | { status: 'duplicate'; id: string }
  // Gravado como `suppressed` (nunca será enviado): endereço com bounce, reclamação ou descadastro.
  | { status: 'suppressed'; id: string; reason: SuppressionReason }
  | { status: 'rejected'; reason: RejectionReason }

// Por que um e-mail nem chega a ser gravado: `undeliverable_address` = `.invalid` (conta
// anonimizada); os outros três só valem para categoria opcional (social, engajamento).
export type RejectionReason =
  'undeliverable_address' | 'not_opted_in' | 'recipient_not_eligible' | 'recipient_unknown'

// O que só o e-mail opcional precisa: preferência (opt-in), elegibilidade do destinatário e o
// link de cancelar inscrição que entra no payload.
export interface OptionalEmailDeps {
  preferences: EmailPreferencesRepository
  recipients: RecipientDirectory
  unsubscribeLinks: UnsubscribeLinks
}

// Única porta de entrada do envio: os módulos de negócio nunca falam com o provedor, só
// enfileiram. A lista de supressão é consultada aqui (e de novo na entrega). Categoria opcional
// (D8) exige destinatário conhecido, ativo e verificado, com a categoria ligada por ele, e ganha
// o `unsubscribeUrl` no payload (o renderer recusa opcional sem ele). Segurança e transacional
// ignoram preferência: nunca são desligáveis.
export class EnqueueEmailUseCase {
  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly suppressions: EmailSuppressionRepository,
    private readonly optional: OptionalEmailDeps,
  ) {}

  async execute(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
    const toAddress = normalizeAddress(input.to)
    if (isUndeliverableAddress(toAddress)) {
      return { status: 'rejected', reason: 'undeliverable_address' }
    }

    let payload = input.payload
    if (isOptionalCategory(input.category)) {
      const gate = await this.checkOptional(input.userId, input.category)
      if (gate.rejected) return { status: 'rejected', reason: gate.rejected }
      payload = { ...payload, unsubscribeUrl: gate.unsubscribeUrl }
    }

    const reason = await this.suppressions.find(toAddress)
    const suppressedBy =
      reason && isBlockedBySuppression(reason, input.category) ? reason : undefined

    const { id, created } = await this.outbox.enqueue({
      userId: input.userId,
      toAddress,
      templateKey: input.templateKey,
      category: input.category,
      payload,
      idempotencyKey: input.idempotencyKey,
      sendAt: input.sendAt,
      suppressedBy,
    })
    if (suppressedBy && created) return { status: 'suppressed', id, reason: suppressedBy }
    return { status: created ? 'enqueued' : 'duplicate', id }
  }

  private async checkOptional(
    userId: string | null,
    category: OptionalEmailCategory,
  ): Promise<
    | { rejected: RejectionReason; unsubscribeUrl?: never }
    | { rejected?: never; unsubscribeUrl: string }
  > {
    if (!userId) return { rejected: 'recipient_unknown' }
    const recipient = await this.optional.recipients.find(userId)
    if (!recipient) return { rejected: 'recipient_unknown' }
    if (!isEligibleForOptionalEmail(recipient)) return { rejected: 'recipient_not_eligible' }
    const preferences = await this.optional.preferences.get(userId)
    if (!preferences[category]) return { rejected: 'not_opted_in' }
    return { unsubscribeUrl: this.optional.unsubscribeLinks.build({ userId, category }) }
  }
}
