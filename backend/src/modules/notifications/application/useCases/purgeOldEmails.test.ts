import { describe, expect, it } from 'vitest'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { PurgeOldEmailsUseCase } from './purgeOldEmails'

const NOW = new Date('2026-10-10T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60_000)

async function seed(
  outbox: ReturnType<typeof createFakeEmailOutboxRepository>,
  key: string,
  status: 'pending' | 'sent' | 'failed' | 'suppressed',
  closedDaysAgo: number,
) {
  const { id } = await outbox.enqueue({
    userId: null,
    toAddress: `${key}@exemplo.com`,
    templateKey: 'welcome',
    category: 'transactional',
    payload: { username: key },
    idempotencyKey: key,
  })
  const row = outbox.rows.find((r) => r.id === id)!
  row.status = status
  row.createdAt = daysAgo(closedDaysAgo)
  if (status === 'sent') row.sentAt = daysAgo(closedDaysAgo)
  return row
}

describe('PurgeOldEmailsUseCase', () => {
  it('limpa endereço e payload do que fechou há mais de 30 dias e preserva o resto', async () => {
    const outbox = createFakeEmailOutboxRepository(() => NOW)
    const oldSent = await seed(outbox, 'old-sent', 'sent', 31)
    const oldFailed = await seed(outbox, 'old-failed', 'failed', 45)
    const oldSuppressed = await seed(outbox, 'old-suppressed', 'suppressed', 60)
    const recentSent = await seed(outbox, 'recent-sent', 'sent', 29)
    const oldPending = await seed(outbox, 'old-pending', 'pending', 90)

    const result = await new PurgeOldEmailsUseCase(outbox, 30, () => NOW).execute()

    expect(result).toEqual({ scrubbed: 3 })
    for (const row of [oldSent, oldFailed, oldSuppressed]) {
      expect(row.toAddress).toBe('')
      expect(row.payload).toEqual({})
      expect(row.templateKey).toBe('welcome')
      expect(row.status).not.toBe('pending')
    }
    expect(recentSent.toAddress).toBe('recent-sent@exemplo.com')
    expect(recentSent.payload).toEqual({ username: 'recent-sent' })
    // Fila ainda aberta nunca é limpa, por mais velha que seja.
    expect(oldPending.toAddress).toBe('old-pending@exemplo.com')
  })

  it('é idempotente: a segunda rodada não reconta linhas já limpas', async () => {
    const outbox = createFakeEmailOutboxRepository(() => NOW)
    await seed(outbox, 'old', 'sent', 40)
    const useCase = new PurgeOldEmailsUseCase(outbox, 30, () => NOW)

    expect((await useCase.execute()).scrubbed).toBe(1)
    expect((await useCase.execute()).scrubbed).toBe(0)
  })

  it('o fechamento de uma linha enviada conta pela data de envio, não pela de criação', async () => {
    const outbox = createFakeEmailOutboxRepository(() => NOW)
    const row = await seed(outbox, 'retried', 'sent', 1)
    row.createdAt = daysAgo(50)

    expect((await new PurgeOldEmailsUseCase(outbox, 30, () => NOW).execute()).scrubbed).toBe(0)
  })
})
