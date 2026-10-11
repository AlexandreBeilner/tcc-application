import { describe, expect, it } from 'vitest'
import { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import { createFakeEmailOutboxRepository } from '../../../notifications/test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailPreferencesRepository } from '../../../notifications/test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../../notifications/test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../../notifications/test/fakes/fakeRecipientDirectory'
import { createFakeUnsubscribeLinks } from '../../../notifications/test/fakes/fakeUnsubscribe'
import type { AssemblyResultSummary } from '../../application/ports/resultPublishers'
import { createNotificationsResultMailer } from './notificationsResultMailer'

const result: AssemblyResultSummary = {
  assemblyId: 'asm-1',
  subjectLabel: 'Acme',
  title: 'Orçamento de capital',
  outcome: 'approved',
  reason: 'decided',
  winningLabel: 'Expandir',
}

function setup(preferences: Record<string, { social: boolean }>) {
  const outbox = createFakeEmailOutboxRepository()
  const recipients = createFakeRecipientDirectory({
    u1: { address: 'ana@exemplo.com', name: 'Ana', status: 'active', emailVerified: true },
  })
  const enqueueEmail = new EnqueueEmailUseCase(outbox, createFakeEmailSuppressionRepository(), {
    preferences: createFakeEmailPreferencesRepository(preferences),
    recipients,
    unsubscribeLinks: createFakeUnsubscribeLinks(),
  })
  return { outbox, mailer: createNotificationsResultMailer({ enqueueEmail, recipients }) }
}

describe('notificationsResultMailer', () => {
  it('quem ligou o e-mail social recebe, uma vez por assembleia', async () => {
    const { outbox, mailer } = setup({ u1: { social: true } })

    await mailer.sendResult('u1', result)
    await mailer.sendResult('u1', result)

    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0]).toMatchObject({
      templateKey: 'assembly_result',
      category: 'social',
      idempotencyKey: 'assembly-result:asm-1:u1',
      toAddress: 'ana@exemplo.com',
    })
    expect(outbox.rows[0].payload).toMatchObject({
      name: 'Ana',
      assemblyId: 'asm-1',
      companyName: 'Acme',
      outcome: 'approved',
      winningLabel: 'Expandir',
    })
  })

  it('assembleia sem decisão segue sem a opção vencedora', async () => {
    const { outbox, mailer } = setup({ u1: { social: true } })

    await mailer.sendResult('u1', {
      ...result,
      outcome: 'not_approved',
      reason: 'quorum',
      winningLabel: null,
    })

    expect(outbox.rows[0].payload).not.toHaveProperty('winningLabel')
    expect(outbox.rows[0].payload).toMatchObject({ outcome: 'not_approved', reason: 'quorum' })
  })

  it('sem opt-in (o padrão) nada é gravado', async () => {
    const { outbox, mailer } = setup({})

    await mailer.sendResult('u1', result)

    expect(outbox.rows).toHaveLength(0)
  })

  it('destinatário desconhecido não derruba a publicação', async () => {
    const { outbox, mailer } = setup({ ghost: { social: true } })

    await expect(mailer.sendResult('ghost', result)).resolves.toBeUndefined()
    expect(outbox.rows).toHaveLength(0)
  })
})
