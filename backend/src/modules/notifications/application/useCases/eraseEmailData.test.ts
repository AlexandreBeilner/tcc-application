import { describe, expect, it } from 'vitest'
import { EraseEmailDataUseCase } from './eraseEmailData'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'

const row = (userId: string | null, templateKey: string, key: string) => ({
  userId,
  toAddress: 'ana@exemplo.com',
  templateKey,
  category: 'transactional' as const,
  payload: { n: key },
  idempotencyKey: key,
})

describe('EraseEmailDataUseCase', () => {
  it('apaga preferências e outbox do usuário, menos a confirmação de exclusão', async () => {
    const outbox = createFakeEmailOutboxRepository()
    const preferences = createFakeEmailPreferencesRepository({
      u1: { social: true },
      u2: { social: true },
    })
    await outbox.enqueue(row('u1', 'welcome', 'a'))
    await outbox.enqueue(row('u1', 'password_reset', 'b'))
    await outbox.enqueue(row('u1', 'account_deleted', 'c'))
    await outbox.enqueue(row('u2', 'welcome', 'd'))
    await outbox.enqueue(row(null, 'announcement', 'e'))

    await new EraseEmailDataUseCase(outbox, preferences).execute({ userId: 'u1' })

    expect(outbox.rows.map((r) => r.idempotencyKey).sort()).toEqual(['c', 'd', 'e'])
    expect(preferences.rows.has('u1')).toBe(false)
    expect(preferences.rows.has('u2')).toBe(true)
  })
})
