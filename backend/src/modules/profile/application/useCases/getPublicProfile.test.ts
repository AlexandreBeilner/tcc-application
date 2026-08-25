import { describe, expect, it } from 'vitest'
import { UserNotFoundError } from '../../domain/errors'
import { createFakeAchievementsReader } from '../../test/fakes/fakeAchievementsReader'
import { createFakeGamificationReader } from '../../test/fakes/fakeGamificationReader'
import { createFakeProfitabilityReader } from '../../test/fakes/fakeProfitabilityReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { GetPublicProfileUseCase } from './getPublicProfile'

const user = { id: 'u1', username: 'alice', createdAt: new Date('2026-01-01T00:00:00Z') }

function build() {
  const userDirectory = createFakeUserDirectory([user])
  const gamificationReader = createFakeGamificationReader({
    u1: { level: 3, xp: 350, currentStreak: 5 },
  })
  const achievementsReader = createFakeAchievementsReader({
    u1: [
      {
        id: 'a1',
        name: 'Primeira Semana',
        description: null,
        unlockedAt: new Date('2026-08-20T00:00:00Z'),
      },
    ],
  })
  const profitabilityReader = createFakeProfitabilityReader({ u1: 12.5 })
  const useCase = new GetPublicProfileUseCase(
    userDirectory,
    gamificationReader,
    achievementsReader,
    profitabilityReader,
  )
  return { useCase }
}

describe('GetPublicProfileUseCase', () => {
  it('combina gamificação, conquistas desbloqueadas e rentabilidade num único perfil', async () => {
    const { useCase } = build()

    const profile = await useCase.execute({ userId: 'u1' })

    expect(profile).toEqual({
      username: 'alice',
      level: 3,
      xp: 350,
      currentStreak: 5,
      achievements: [
        {
          id: 'a1',
          name: 'Primeira Semana',
          description: null,
          unlockedAt: new Date('2026-08-20T00:00:00Z'),
        },
      ],
      profitabilityPct: 12.5,
      window: 'week',
    })
  })

  it('usa month quando pedido explicitamente', async () => {
    const { useCase } = build()

    const profile = await useCase.execute({ userId: 'u1', window: 'month' })

    expect(profile.window).toBe('month')
  })

  it('404 pra usuário inexistente', async () => {
    const { useCase } = build()

    await expect(useCase.execute({ userId: 'nope' })).rejects.toBeInstanceOf(UserNotFoundError)
  })

  it('RNF09: resposta nunca contém nenhum campo monetário/patrimônio absoluto', async () => {
    const { useCase } = build()

    const profile = await useCase.execute({ userId: 'u1' })

    const forbiddenKeys = ['total', 'cash', 'netWorth', 'balance', 'patrimonio', 'saldo']
    const keys = Object.keys(profile).map((k) => k.toLowerCase())
    for (const forbidden of forbiddenKeys) {
      expect(keys).not.toContain(forbidden.toLowerCase())
    }
  })
})
