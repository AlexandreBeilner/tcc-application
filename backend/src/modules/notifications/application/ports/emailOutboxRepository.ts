import type { EmailCategory, OutboxEmail } from '../../domain/emailMessage'

export interface NewOutboxEmail {
  userId: string | null
  toAddress: string
  templateKey: string
  category: EmailCategory
  payload: Record<string, unknown>
  idempotencyKey: string
  // Padrão: agora. Permite agendar (ex.: lote de comunicado).
  sendAt?: Date
}

export interface EmailOutboxRepository {
  // Idempotente por `idempotencyKey`: repetir devolve a linha existente com `created: false`.
  enqueue(input: NewOutboxEmail): Promise<{ id: string; created: boolean }>
  // Reivindica até `limit` linhas `pending` vencidas, sem bloquear nem duplicar entre
  // réplicas (`FOR UPDATE SKIP LOCKED`): passam a `sending`, `attempts + 1`, `claimedAt = now`.
  claimBatch(limit: number, now: Date): Promise<OutboxEmail[]>
  markSent(id: string, providerMessageId: string, now: Date): Promise<void>
  markForRetry(id: string, error: string, nextAttemptAt: Date): Promise<void>
  markFailed(id: string, error: string): Promise<void>
  // Linhas `sending` reivindicadas antes de `claimedBefore` (processo caiu no meio): voltam a
  // `pending`, ou vão a `failed` se já esgotaram `maxAttempts`. Devolve quantas mexeu.
  recoverStuck(claimedBefore: Date, maxAttempts: number): Promise<number>
}
