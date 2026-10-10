import type { EmailCategory, OutboxEmail } from '../../domain/emailMessage'
import type { SuppressionReason } from '../../domain/suppression'

export interface NewOutboxEmail {
  userId: string | null
  toAddress: string
  templateKey: string
  category: EmailCategory
  payload: Record<string, unknown>
  idempotencyKey: string
  // Padrão: agora. Permite agendar (ex.: lote de comunicado).
  sendAt?: Date
  // Endereço suprimido na hora de enfileirar: a linha nasce `suppressed` (nunca é enviada, mas
  // fica registrada pra explicar por que o e-mail não chegou).
  suppressedBy?: SuppressionReason
}

export interface EmailOutboxRepository {
  // Idempotente por `idempotencyKey`: repetir devolve a linha existente com `created: false`.
  enqueue(input: NewOutboxEmail): Promise<{ id: string; created: boolean }>
  // Reivindica até `limit` linhas `pending` vencidas, sem bloquear nem duplicar entre
  // réplicas (`FOR UPDATE SKIP LOCKED`): passam a `sending`, `attempts + 1`, `claimedAt = now`.
  claimBatch(limit: number, now: Date): Promise<OutboxEmail[]>
  // `scrubFields`: chaves do payload apagadas ao fechar a linha (ex.: o link com token de um
  // e-mail de reset: depois de enviado ou falho, o token em claro não fica no banco).
  markSent(
    id: string,
    providerMessageId: string,
    now: Date,
    scrubFields?: readonly string[],
  ): Promise<void>
  markForRetry(id: string, error: string, nextAttemptAt: Date): Promise<void>
  markFailed(id: string, error: string, scrubFields?: readonly string[]): Promise<void>
  // Suprimido entre o enfileiramento e a entrega (um bounce chegou nesse intervalo).
  markSuppressed(id: string, reason: SuppressionReason): Promise<void>
  // Confirmação de entrega vinda do webhook, localizada pelo id que o provedor devolveu.
  markDelivered(providerMessageId: string, at: Date): Promise<void>
  // Linhas `sending` reivindicadas antes de `claimedBefore` (processo caiu no meio): voltam a
  // `pending`, ou vão a `failed` se já esgotaram `maxAttempts`. Devolve quantas mexeu.
  recoverStuck(claimedBefore: Date, maxAttempts: number): Promise<number>
}
