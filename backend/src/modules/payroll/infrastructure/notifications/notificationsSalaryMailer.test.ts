import { describe, expect, it } from 'vitest'
import { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import { createFakeEmailOutboxRepository } from '../../../notifications/test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailPreferencesRepository } from '../../../notifications/test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../../notifications/test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../../notifications/test/fakes/fakeRecipientDirectory'
import { createFakeUnsubscribeLinks } from '../../../notifications/test/fakes/fakeUnsubscribe'
import { createNotificationsSalaryMailer } from './notificationsSalaryMailer'

function setup(preferences: Record<string, { engagement: boolean }>) {
  const outbox = createFakeEmailOutboxRepository()
  const recipients = createFakeRecipientDirectory({
    u1: { address: 'ana@exemplo.com', name: 'Ana', status: 'active', emailVerified: true },
  })
  const enqueueEmail = new EnqueueEmailUseCase(outbox, createFakeEmailSuppressionRepository(), {
    preferences: createFakeEmailPreferencesRepository(preferences),
    recipients,
    unsubscribeLinks: createFakeUnsubscribeLinks(),
  })
  return { outbox, mailer: createNotificationsSalaryMailer({ enqueueEmail, recipients }) }
}

describe('notificationsSalaryMailer', () => {
  it('quem ligou o engajamento recebe um e-mail por mês, idempotente', async () => {
    const { outbox, mailer } = setup({ u1: { engagement: true } })
    const input = { userId: 'u1', monthKeys: ['2026-09', '2026-10'], amountPerMonth: 1000 }

    await mailer.sendSalaryCredited(input)
    await mailer.sendSalaryCredited(input)

    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0]).toMatchObject({
      templateKey: 'salary_credited',
      category: 'engagement',
      idempotencyKey: 'salary:u1:2026-10',
    })
    expect(outbox.rows[0].payload).toMatchObject({
      name: 'Ana',
      firstMonth: '2026-09',
      lastMonth: '2026-10',
      months: 2,
      amountPerMonth: 1000,
    })
  })

  it('sem opt-in, ou sem mês, nada é gravado', async () => {
    const off = setup({})
    await off.mailer.sendSalaryCredited({ userId: 'u1', monthKeys: ['2026-10'], amountPerMonth: 1 })
    const empty = setup({ u1: { engagement: true } })
    await empty.mailer.sendSalaryCredited({ userId: 'u1', monthKeys: [], amountPerMonth: 1 })

    expect(off.outbox.rows).toHaveLength(0)
    expect(empty.outbox.rows).toHaveLength(0)
  })
})
