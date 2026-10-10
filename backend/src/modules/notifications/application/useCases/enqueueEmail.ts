import {
  isUndeliverableAddress,
  normalizeAddress,
  type EmailCategory,
} from '../../domain/emailMessage'
import { isBlockedBySuppression, type SuppressionReason } from '../../domain/suppression'
import type { EmailOutboxRepository } from '../ports/emailOutboxRepository'
import type { EmailSuppressionRepository } from '../ports/emailSuppressionRepository'

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
  | { status: 'rejected'; reason: 'undeliverable_address' }

// Única porta de entrada do envio: os módulos de negócio nunca falam com o provedor, só
// enfileiram. A lista de supressão é consultada aqui (e de novo na entrega); preferência por
// categoria e opt-in entram na EM.6.1.
export class EnqueueEmailUseCase {
  constructor(
    private readonly outbox: EmailOutboxRepository,
    private readonly suppressions: EmailSuppressionRepository,
  ) {}

  async execute(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
    const toAddress = normalizeAddress(input.to)
    if (isUndeliverableAddress(toAddress)) {
      return { status: 'rejected', reason: 'undeliverable_address' }
    }

    const reason = await this.suppressions.find(toAddress)
    const suppressedBy =
      reason && isBlockedBySuppression(reason, input.category) ? reason : undefined

    const { id, created } = await this.outbox.enqueue({
      userId: input.userId,
      toAddress,
      templateKey: input.templateKey,
      category: input.category,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      sendAt: input.sendAt,
      suppressedBy,
    })
    if (suppressedBy && created) return { status: 'suppressed', id, reason: suppressedBy }
    return { status: created ? 'enqueued' : 'duplicate', id }
  }
}
