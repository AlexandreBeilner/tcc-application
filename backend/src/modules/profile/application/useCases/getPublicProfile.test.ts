import { describe, expect, it } from 'vitest'
import { UserNotFoundError } from '../../domain/errors'
import { createFakeAchievementsReader } from '../../test/fakes/fakeAchievementsReader'
import { createFakeGamificationReader } from '../../test/fakes/fakeGamificationReader'
import { createFakeProfitabilityReader } from '../../test/fakes/fakeProfitabilityReader'
import { createFakeTrackCompletionReader } from '../../test/fakes/fakeTrackCompletionReader'
import { createFakeUserDirectory } from '../../test/fakes/fakeUserDirectory'
import { GetPublicProfileUseCase } from './getPublicProfile'

const user = {
  id: 'u1',
  username: 'alice',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  avatarPath: 'u1-abc.jpg',
}

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
  const trackCompletionReader = createFakeTrackCompletionReader(
    { u1: [0, 1] },
    { u1: ['0.1', '0.2'] },
  )
  const useCase = new GetPublicProfileUseCase(
    userDirectory,
    gamificationReader,
    achievementsReader,
    profitabilityReader,
    trackCompletionReader,
  )
  return { useCase }
}

describe('GetPublicProfileUseCase', () => {
  it('combina gamificação, conquistas desbloqueadas e rentabilidade num único perfil', async () => {
    const { useCase } = build()

    const profile = await useCase.execute({ userId: 'u1' })

    expect(profile).toEqual({
      username: 'alice',
      avatarUrl: '/avatars/u1-abc.jpg',
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
      completedTracks: [0, 1],
      completedLessonCodes: ['0.1', '0.2'],
      cosmetics: { isPro: false, frame: null, title: null },
    })
  })

  it('avatarUrl é null quando o usuário nunca fez upload (6.10.8)', async () => {
    const userDirectory = createFakeUserDirectory([{ ...user, avatarPath: null }])
    const gamificationReader = createFakeGamificationReader({
      u1: { level: 3, xp: 350, currentStreak: 5 },
    })
    const achievementsReader = createFakeAchievementsReader({ u1: [] })
    const profitabilityReader = createFakeProfitabilityReader({ u1: 12.5 })
    const trackCompletionReader = createFakeTrackCompletionReader({ u1: [] })
    const useCase = new GetPublicProfileUseCase(
      userDirectory,
      gamificationReader,
      achievementsReader,
      profitabilityReader,
      trackCompletionReader,
    )

    const profile = await useCase.execute({ userId: 'u1' })

    expect(profile.avatarUrl).toBeNull()
  })

  it('sem nenhuma trilha concluída → completedTracks vazio', async () => {
    const userDirectory = createFakeUserDirectory([user])
    const gamificationReader = createFakeGamificationReader({
      u1: { level: 3, xp: 350, currentStreak: 5 },
    })
    const achievementsReader = createFakeAchievementsReader({ u1: [] })
    const profitabilityReader = createFakeProfitabilityReader({ u1: 12.5 })
    const trackCompletionReader = createFakeTrackCompletionReader({ u1: [] })
    const useCase = new GetPublicProfileUseCase(
      userDirectory,
      gamificationReader,
      achievementsReader,
      profitabilityReader,
      trackCompletionReader,
    )

    const profile = await useCase.execute({ userId: 'u1' })

    expect(profile.completedTracks).toEqual([])
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

  it('perfil de assinante PRO inclui selo, moldura e título (MO.5.1)', async () => {
    const useCase = new GetPublicProfileUseCase(
      createFakeUserDirectory([user]),
      createFakeGamificationReader({ u1: { level: 3, xp: 350, currentStreak: 5 } }),
      createFakeAchievementsReader({ u1: [] }),
      createFakeProfitabilityReader({ u1: 12.5 }),
      createFakeTrackCompletionReader({ u1: [] }),
      {
        findDisplays: async () =>
          new Map([['u1', { isPro: true, frame: 'frame_aurora', title: 'Estrategista' }]]),
      },
    )

    const profile = await useCase.execute({ userId: 'u1' })

    expect(profile.cosmetics).toEqual({ isPro: true, frame: 'frame_aurora', title: 'Estrategista' })
  })
})
