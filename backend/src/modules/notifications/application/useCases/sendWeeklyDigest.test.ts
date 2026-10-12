import { describe, expect, it, vi } from 'vitest'
import type { DigestCandidate, WeeklyDigestAudience } from '../ports/weeklyDigestAudience'
import { createFakeEmailOutboxRepository } from '../../test/fakes/fakeEmailOutboxRepository'
import { createFakeEmailPreferencesRepository } from '../../test/fakes/fakeEmailPreferencesRepository'
import { createFakeEmailSuppressionRepository } from '../../test/fakes/fakeEmailSuppressionRepository'
import { createFakeRecipientDirectory } from '../../test/fakes/fakeRecipientDirectory'
import { createFakeUnsubscribeLinks } from '../../test/fakes/fakeUnsubscribe'
import { EnqueueEmailUseCase } from './enqueueEmail'
import { SendWeeklyDigestUseCase } from './sendWeeklyDigest'

const MONDAY_10H = new Date('2026-10-12T13:00:00Z')
const TUESDAY = new Date('2026-10-13T13:00:00Z')

function candidate(n: number, overrides: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    userId: `u${String(n).padStart(3, '0')}`,
    address: `u${n}@exemplo.com`,
    name: `Usuário ${n}`,
    level: 5,
    weeklyReturnPct: 1.5,
    pendingMissions: 1,
    pendingMissionTitle: 'Conclua uma lição',
    ...overrides,
  }
}

function fakeAudience(
  all: DigestCandidate[],
): WeeklyDigestAudience & { listPage: ReturnType<typeof vi.fn> } {
  return {
    listPage: vi.fn(async (after: string | null, limit: number) =>
      all.filter((c) => after === null || c.userId > after).slice(0, limit),
    ),
  }
}

function setup(all: DigestCandidate[], now: Date, optedOut: string[] = []) {
  const outbox = createFakeEmailOutboxRepository(() => now)
  const recipients = Object.fromEntries(
    all.map((c) => [
      c.userId,
      { address: c.address, status: 'active', emailVerified: true } as const,
    ]),
  )
  const preferences = createFakeEmailPreferencesRepository(
    Object.fromEntries(
      all.filter((c) => !optedOut.includes(c.userId)).map((c) => [c.userId, { engagement: true }]),
    ),
  )
  const enqueue = new EnqueueEmailUseCase(outbox, createFakeEmailSuppressionRepository(), {
    preferences,
    recipients: createFakeRecipientDirectory(recipients),
    unsubscribeLinks: createFakeUnsubscribeLinks(),
  })
  const audience = fakeAudience(all)
  return { outbox, audience, useCase: new SendWeeklyDigestUseCase(audience, enqueue, () => now) }
}

describe('SendWeeklyDigestUseCase', () => {
  it('fora da janela não lê nem enfileira nada', async () => {
    const { outbox, audience, useCase } = setup([candidate(1)], TUESDAY)

    const result = await useCase.execute()

    expect(result).toMatchObject({ due: false, considered: 0, enqueued: 0 })
    expect(audience.listPage).not.toHaveBeenCalled()
    expect(outbox.rows).toHaveLength(0)
  })

  it('na segunda enfileira um resumo por pessoa, com só nível, percentual e missão', async () => {
    const { outbox, useCase } = setup(
      [candidate(1), candidate(2, { weeklyReturnPct: null })],
      MONDAY_10H,
    )

    const result = await useCase.execute()

    expect(result).toMatchObject({ due: true, considered: 2, enqueued: 2 })
    expect(outbox.rows.map((r) => r.templateKey)).toEqual(['weekly_digest', 'weekly_digest'])
    expect(outbox.rows[0].category).toBe('engagement')
    expect(outbox.rows[0].idempotencyKey).toBe('weekly-digest:u001:2026-10-12')
    expect(Object.keys(outbox.rows[0].payload).sort()).toEqual(
      [
        'level',
        'missionTitle',
        'name',
        'pendingMissions',
        'unsubscribeUrl',
        'weeklyReturnPct',
      ].sort(),
    )
    expect(outbox.rows[1].payload).not.toHaveProperty('weeklyReturnPct')
  })

  it('rodar de novo na mesma semana não duplica (o job roda várias vezes na janela)', async () => {
    const { outbox, useCase } = setup([candidate(1)], MONDAY_10H)

    await useCase.execute()
    const second = await useCase.execute()

    expect(second).toMatchObject({ enqueued: 0, skipped: 1 })
    expect(outbox.rows).toHaveLength(1)
  })

  it('quem desligou o e-mail entre a leitura e o envio não recebe', async () => {
    const { outbox, useCase } = setup([candidate(1), candidate(2)], MONDAY_10H, ['u002'])

    const result = await useCase.execute()

    expect(result).toMatchObject({ considered: 2, enqueued: 1, skipped: 1 })
    expect(outbox.rows.map((r) => r.userId)).toEqual(['u001'])
  })

  it('percorre todas as páginas da audiência', async () => {
    const all = Array.from({ length: 450 }, (_, i) => candidate(i + 1))
    const { outbox, audience, useCase } = setup(all, MONDAY_10H)

    const result = await useCase.execute()

    expect(result.enqueued).toBe(450)
    expect(outbox.rows).toHaveLength(450)
    expect(audience.listPage).toHaveBeenCalledTimes(3)
  })

  it('uma falha num usuário não impede os outros', async () => {
    const { outbox, audience, useCase } = setup([candidate(1), candidate(2)], MONDAY_10H)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const original = outbox.enqueue.bind(outbox)
    outbox.enqueue = async (input) => {
      if (input.userId === 'u001') throw new Error('banco caiu')
      return original(input)
    }

    const result = await useCase.execute()

    expect(result).toMatchObject({ failed: 1, enqueued: 1 })
    expect(audience.listPage).toHaveBeenCalled()
    spy.mockRestore()
  })
})
