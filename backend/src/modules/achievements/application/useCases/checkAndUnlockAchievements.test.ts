import { describe, expect, it } from 'vitest'
import type { Achievement } from '../../domain/achievement'
import { createFakeAchievementRepository } from '../../test/fakes/fakeAchievementRepository'
import { createFakeProgressSnapshotReader } from '../../test/fakes/fakeProgressSnapshotReader'
import { CheckAndUnlockAchievementsUseCase } from './checkAndUnlockAchievements'

const catalog: Achievement[] = [
  {
    id: 'a-streak-7',
    name: 'Primeira Semana',
    description: null,
    criteriaType: 'streak_days',
    criteriaValue: 7,
  },
  {
    id: 'a-lessons-10',
    name: 'Estudioso',
    description: null,
    criteriaType: 'lessons_completed',
    criteriaValue: 10,
  },
  {
    id: 'a-networth-12000',
    name: 'Primeiro Patrimônio',
    description: null,
    criteriaType: 'net_worth',
    criteriaValue: 12000,
  },
  {
    id: 'a-trades-1',
    name: 'Primeira Operação',
    description: null,
    criteriaType: 'trades_executed',
    criteriaValue: 1,
  },
]

describe('CheckAndUnlockAchievementsUseCase', () => {
  it('desbloqueia só as conquistas cujo critério o snapshot satisfaz', async () => {
    const achievementRepository = createFakeAchievementRepository(catalog)
    const progressSnapshotReader = createFakeProgressSnapshotReader({
      u1: {
        netWorth: 12500,
        streakDays: 3,
        lessonsCompleted: 2,
        tradesExecuted: 1,
        microDecisionsStreak: 0,
        tracksCompletedNoErrors: 0,
        lessonsReviewed: 0,
      },
    })
    const useCase = new CheckAndUnlockAchievementsUseCase(
      achievementRepository,
      progressSnapshotReader,
    )

    const newlyUnlocked = await useCase.execute({ userId: 'u1' })

    expect(newlyUnlocked.map((a) => a.id).sort()).toEqual(['a-networth-12000', 'a-trades-1'])
    const unlocked = await achievementRepository.listUnlockedForUser('u1')
    expect(unlocked.map((u) => u.achievementId).sort()).toEqual(['a-networth-12000', 'a-trades-1'])
  })

  it('é idempotente — não desbloqueia de novo o que já estava desbloqueado', async () => {
    const achievementRepository = createFakeAchievementRepository(catalog)
    const progressSnapshotReader = createFakeProgressSnapshotReader({
      u1: {
        netWorth: 0,
        streakDays: 10,
        lessonsCompleted: 0,
        tradesExecuted: 0,
        microDecisionsStreak: 0,
        tracksCompletedNoErrors: 0,
        lessonsReviewed: 0,
      },
    })
    const useCase = new CheckAndUnlockAchievementsUseCase(
      achievementRepository,
      progressSnapshotReader,
    )
    await useCase.execute({ userId: 'u1' })

    const secondCall = await useCase.execute({ userId: 'u1' })

    expect(secondCall).toEqual([])
    const unlocked = await achievementRepository.listUnlockedForUser('u1')
    expect(unlocked).toHaveLength(1)
  })

  it('não desbloqueia nada quando nenhum critério é satisfeito', async () => {
    const achievementRepository = createFakeAchievementRepository(catalog)
    const progressSnapshotReader = createFakeProgressSnapshotReader()
    const useCase = new CheckAndUnlockAchievementsUseCase(
      achievementRepository,
      progressSnapshotReader,
    )

    const newlyUnlocked = await useCase.execute({ userId: 'u1' })

    expect(newlyUnlocked).toEqual([])
  })
})
