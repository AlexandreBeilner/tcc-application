import { describe, expect, it } from 'vitest'
import type { Achievement } from '../../domain/achievement'
import { createFakeAchievementRepository } from '../../test/fakes/fakeAchievementRepository'
import { createFakeProgressSnapshotReader } from '../../test/fakes/fakeProgressSnapshotReader'
import { ListAchievementsUseCase } from './listAchievements'

const catalog: Achievement[] = [
  {
    id: 'a-streak-7',
    name: 'Primeira Semana',
    description: null,
    criteriaType: 'streak_days',
    criteriaValue: 7,
    isActive: true,
  },
  {
    id: 'a-streak-30',
    name: 'Fiel',
    description: null,
    criteriaType: 'streak_days',
    criteriaValue: 30,
    isActive: true,
  },
]

describe('ListAchievementsUseCase', () => {
  it('mostra o catálogo inteiro com status e progresso atual', async () => {
    const achievementRepository = createFakeAchievementRepository(catalog)
    await achievementRepository.unlock('u1', 'a-streak-7')
    const progressSnapshotReader = createFakeProgressSnapshotReader({
      u1: {
        netWorth: 0,
        streakDays: 9,
        lessonsCompleted: 0,
        tradesExecuted: 0,
        microDecisionsStreak: 0,
        tracksCompletedNoErrors: 0,
        lessonsReviewed: 0,
        assembliesParticipated: 0,
        referralsQualified: 0,
        dailyWordFirstTry: 0,
        dailyPerfectDays: 0,
      },
    })
    const useCase = new ListAchievementsUseCase(achievementRepository, progressSnapshotReader)

    const views = await useCase.execute({ userId: 'u1' })

    const unlocked = views.find((v) => v.id === 'a-streak-7')
    const locked = views.find((v) => v.id === 'a-streak-30')
    expect(unlocked?.unlocked).toBe(true)
    expect(unlocked?.progress).toBe(9)
    expect(locked?.unlocked).toBe(false)
    expect(locked?.progress).toBe(9)
  })
})
