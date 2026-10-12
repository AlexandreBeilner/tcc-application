import { describe, expect, it, vi } from 'vitest'
import type {
  StreakReminderAudience,
  StreakReminderCandidate,
} from '../ports/streakReminderAudience'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../test/fakes/fakeRecipientDirectory'
import { createFakeUnsubscribeLinks } from '../../test/fakes/fakeUnsubscribe'
import { EnqueueEmailUseCase } from './enqueueEmail'
import { SendStreakRemindersUseCase } from './sendStreakReminders'

// 18h de Brasília de segunda, 2026-10-12.
const IN_WINDOW = new Date('2026-10-12T21:00:00Z')
const MORNING = new Date('2026-10-12T12:00:00Z')

const candidate = (n: number, streak = 5): StreakReminderCandidate => ({
  userId: `u${n}`,
  address: `u${n}@exemplo.com`,
  name: `Usuário ${n}`,
  currentStreak: streak,
})

function setup(
  all: StreakReminderCandidate[],
  now: Date,
  options: { optedOut?: string[]; suspended?: string[] } = {},
) {
  const outbox = createFakeEmailOutboxRepository(() => now)
  const recipients = createFakeRecipientDirectory(
    Object.fromEntries(
      all.map((c) => [
        c.userId,
        {
          address: c.address,
          status: options.suspended?.includes(c.userId) ? 'suspended' : 'active',
          emailVerified: true,
        } as const,
      ]),
    ),
  )
  const preferences = createFakeEmailPreferencesRepository(
    Object.fromEntries(
      all
        .filter((c) => !options.optedOut?.includes(c.userId))
        .map((c) => [c.userId, { engagement: true }]),
    ),
  )
  const enqueue = new EnqueueEmailUseCase(outbox, createFakeEmailSuppressionRepository(), {
    preferences,
    recipients,
    unsubscribeLinks: createFakeUnsubscribeLinks(),
  })
  const audience: StreakReminderAudience & { listPage: ReturnType<typeof vi.fn> } = {
    listPage: vi.fn(async (after: string | null, limit: number) =>
      all.filter((c) => after === null || c.userId > after).slice(0, limit),
    ),
  }
  return { outbox, audience, useCase: new SendStreakRemindersUseCase(audience, enqueue, () => now) }
}

describe('SendStreakRemindersUseCase', () => {
  it('fora da janela da tarde não lê nem enfileira nada', async () => {
    const { outbox, audience, useCase } = setup([candidate(1)], MORNING)

    const result = await useCase.execute()

    expect(result).toMatchObject({ due: false, considered: 0 })
    expect(audience.listPage).not.toHaveBeenCalled()
    expect(outbox.rows).toHaveLength(0)
  })

  it('pede à audiência quem fez a última atividade ontem e tem sequência mínima', async () => {
    const { audience, useCase } = setup([], IN_WINDOW)

    await useCase.execute()

    expect(audience.listPage).toHaveBeenCalledWith(null, 200, {
      lastActivityDay: '2026-10-11',
      minStreak: 3,
    })
  })

  it('enfileira um lembrete por pessoa, só com nome e tamanho da sequência', async () => {
    const { outbox, useCase } = setup([candidate(1, 12)], IN_WINDOW)

    const result = await useCase.execute()

    expect(result).toMatchObject({ due: true, considered: 1, enqueued: 1 })
    expect(outbox.rows[0]).toMatchObject({
      templateKey: 'streak_reminder',
      category: 'engagement',
      idempotencyKey: 'streak-reminder:u1:2026-10-12',
    })
    expect(Object.keys(outbox.rows[0].payload).sort()).toEqual(['name', 'streak', 'unsubscribeUrl'])
  })

  it('teto de 1 por dia: rodar de novo na janela não duplica', async () => {
    const { outbox, useCase } = setup([candidate(1)], IN_WINDOW)

    await useCase.execute()
    const again = await useCase.execute()

    expect(again).toMatchObject({ enqueued: 0, skipped: 1 })
    expect(outbox.rows).toHaveLength(1)
  })

  it('no dia seguinte volta a poder avisar', async () => {
    const outbox = createFakeEmailOutboxRepository()
    await outbox.enqueue({
      userId: 'u1',
      toAddress: 'u1@exemplo.com',
      templateKey: 'streak_reminder',
      category: 'engagement',
      payload: {},
      idempotencyKey: 'streak-reminder:u1:2026-10-11',
    })
    const { useCase, outbox: outbox2 } = setup([candidate(1)], IN_WINDOW)
    expect(outbox2.rows).toHaveLength(0)
    expect((await useCase.execute()).enqueued).toBe(1)
  })

  it('quem desligou o engajamento ou está suspenso não recebe', async () => {
    const { outbox, useCase } = setup([candidate(1), candidate(2), candidate(3)], IN_WINDOW, {
      optedOut: ['u2'],
      suspended: ['u3'],
    })

    const result = await useCase.execute()

    expect(result).toMatchObject({ considered: 3, enqueued: 1, skipped: 2 })
    expect(outbox.rows.map((r) => r.userId)).toEqual(['u1'])
  })

  it('uma falha num usuário não impede os outros', async () => {
    const { outbox, useCase } = setup([candidate(1), candidate(2)], IN_WINDOW)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const original = outbox.enqueue.bind(outbox)
    outbox.enqueue = async (input) => {
      if (input.userId === 'u1') throw new Error('banco caiu')
      return original(input)
    }

    expect(await useCase.execute()).toMatchObject({ failed: 1, enqueued: 1 })
    spy.mockRestore()
  })
})
