import {
  isUndeliverableAddress,
  normalizeAddress,
  type EmailCategory,
} from '../../domain/emailMessage'
import type { EmailOutboxRepository } from '../ports/emailOutboxRepository'

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
  | { status: 'rejected'; reason: 'undeliverable_address' }

// Única porta de entrada do envio: os módulos de negócio nunca falam com o provedor, só
// enfileiram. Supressão, preferência por categoria e opt-in entram aqui nas tarefas EM.1.4 e
// EM.6.1.
export class EnqueueEmailUseCase {
  constructor(private readonly outbox: EmailOutboxRepository) {}

  async execute(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
    const toAddress = normalizeAddress(input.to)
    if (isUndeliverableAddress(toAddress)) {
      return { status: 'rejected', reason: 'undeliverable_address' }
    }

    const { id, created } = await this.outbox.enqueue({
      userId: input.userId,
      toAddress,
      templateKey: input.templateKey,
      category: input.category,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      sendAt: input.sendAt,
    })
    return { status: created ? 'enqueued' : 'duplicate', id }
  }
}
