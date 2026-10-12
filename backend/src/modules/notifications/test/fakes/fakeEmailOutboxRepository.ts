import { randomUUID } from 'node:crypto'
import type { OutboxEmail, OutboxStatus } from '../../domain/emailMessage'
import type {
  EmailOutboxRepository,
  NewOutboxEmail,
} from '../../application/ports/emailOutboxRepository'

export interface FakeOutboxRow extends OutboxEmail {
  claimedAt: Date | null
  providerMessageId: string | null
  lastError: string | null
  sentAt: Date | null
  createdAt: Date
  deliveredAt: Date | null
}

export interface FakeEmailOutboxRepository extends EmailOutboxRepository {
  rows: FakeOutboxRow[]
}

// Mesma semântica do adapter Drizzle, em memória: idempotência por chave, reivindicação que
// só pega `pending` vencida, recuperação de `sending` preso.
export function createFakeEmailOutboxRepository(
  now: () => Date = () => new Date(),
): FakeEmailOutboxRepository {
  const rows: FakeOutboxRow[] = []
  const byId = (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) throw new Error(`linha ${id} não existe`)
    return row
  }
  const scrub = (row: FakeOutboxRow, fields: readonly string[]) => {
    row.payload = Object.fromEntries(
      Object.entries(row.payload).filter(([k]) => !fields.includes(k)),
    )
  }
  const setStatus = (row: FakeOutboxRow, status: OutboxStatus) => {
    row.status = status
  }

  return {
    rows,
    async enqueue(input: NewOutboxEmail) {
      const existing = rows.find((r) => r.idempotencyKey === input.idempotencyKey)
      if (existing) return { id: existing.id, created: false }
      const row: FakeOutboxRow = {
        id: randomUUID(),
        userId: input.userId,
        toAddress: input.toAddress,
        templateKey: input.templateKey,
        category: input.category,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        status: input.suppressedBy ? 'suppressed' : 'pending',
        attempts: 0,
        nextAttemptAt: input.sendAt ?? now(),
        claimedAt: null,
        providerMessageId: null,
        lastError: input.suppressedBy ? `suppressed:${input.suppressedBy}` : null,
        sentAt: null,
        createdAt: now(),
        deliveredAt: null,
      }
      rows.push(row)
      return { id: row.id, created: true }
    },
    async claimBatch(limit, at) {
      const due = rows
        .filter((r) => r.status === 'pending' && r.nextAttemptAt <= at)
        .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime())
        .slice(0, limit)
      for (const row of due) {
        setStatus(row, 'sending')
        row.attempts += 1
        row.claimedAt = at
      }
      return due.map((r) => ({ ...r }))
    },
    async markSent(id, providerMessageId, at, scrubFields = []) {
      const row = byId(id)
      scrub(row, scrubFields)
      setStatus(row, 'sent')
      row.providerMessageId = providerMessageId
      row.sentAt = at
      row.lastError = null
    },
    async markForRetry(id, error, nextAttemptAt) {
      const row = byId(id)
      setStatus(row, 'pending')
      row.lastError = error
      row.nextAttemptAt = nextAttemptAt
      row.claimedAt = null
    },
    async markFailed(id, error, scrubFields = []) {
      const row = byId(id)
      scrub(row, scrubFields)
      setStatus(row, 'failed')
      row.lastError = error
    },
    async markSuppressed(id, reason) {
      const row = byId(id)
      setStatus(row, 'suppressed')
      row.lastError = `suppressed:${reason}`
      row.claimedAt = null
    },
    async markDelivered(providerMessageId, at) {
      for (const row of rows) {
        if (row.providerMessageId === providerMessageId) row.deliveredAt = at
      }
    },
    async recoverStuck(claimedBefore, maxAttempts) {
      const stuck = rows.filter(
        (r) => r.status === 'sending' && r.claimedAt !== null && r.claimedAt < claimedBefore,
      )
      for (const row of stuck) {
        setStatus(row, row.attempts >= maxAttempts ? 'failed' : 'pending')
        row.claimedAt = null
      }
      return stuck.length
    },
    async deleteByUser(userId, { keepTemplateKeys }) {
      const doomed = rows.filter(
        (r) => r.userId === userId && !keepTemplateKeys.includes(r.templateKey),
      )
      for (const row of doomed) rows.splice(rows.indexOf(row), 1)
      return doomed.length
    },
    async scrubClosedBefore(closedBefore) {
      const closed = rows.filter(
        (r) =>
          ['sent', 'failed', 'suppressed'].includes(r.status) &&
          r.toAddress !== '' &&
          (r.sentAt ?? r.createdAt) < closedBefore,
      )
      for (const row of closed) {
        row.toAddress = ''
        row.payload = {}
      }
      return closed.length
    },
  }
}
