import { describe, expect, it } from 'vitest'
import { EnqueueEmailUseCase } from '../../../notifications/application/useCases/enqueueEmail'
import { createFakeEmailOutboxRepository } from '../../../notifications/test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailPreferencesRepository } from '../../../notifications/test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../../notifications/test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../../notifications/test/fakes/fakeRecipientDirectory'
import { createFakeUnsubscribeLinks } from '../../../notifications/test/fakes/fakeUnsubscribe'
import type { Achievement } from '../../domain/achievement'
import { createNotificationsAchievementMailer } from './notificationsAchievementMailer'

const achievement: Achievement = {
  id: 'a1',
  name: 'Fiel',
  description: '30 dias seguidos de atividade.',
  criteriaType: 'streak_days',
  criteriaValue: 30,
  isActive: true,
}

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
  return { outbox, mailer: createNotificationsAchievementMailer({ enqueueEmail, recipients }) }
}

describe('notificationsAchievementMailer', () => {
  it('quem ligou o engajamento recebe, uma vez por conquista', async () => {
    const { outbox, mailer } = setup({ u1: { engagement: true } })

    await mailer.sendRareUnlocked({ userId: 'u1', achievement })
    await mailer.sendRareUnlocked({ userId: 'u1', achievement })

    expect(outbox.rows).toHaveLength(1)
    expect(outbox.rows[0]).toMatchObject({
      templateKey: 'rare_achievement',
      category: 'engagement',
      idempotencyKey: 'achievement-rare:u1:a1',
      toAddress: 'ana@exemplo.com',
    })
    expect(outbox.rows[0].payload).toMatchObject({
      name: 'Ana',
      achievementName: 'Fiel',
      achievementDescription: '30 dias seguidos de atividade.',
    })
  })

  it('sem opt-in nada é gravado', async () => {
    const { outbox, mailer } = setup({})

    await mailer.sendRareUnlocked({ userId: 'u1', achievement })

    expect(outbox.rows).toHaveLength(0)
  })
})
