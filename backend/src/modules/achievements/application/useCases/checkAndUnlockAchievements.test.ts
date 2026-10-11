import { describe, expect, it, vi } from 'vitest'
import type { Achievement } from '../../domain/achievement'
import { createFakeAchievementMailer } from '../../test/fakes/fakeAchievementNotifications'
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
    isActive: true,
    isRare: false,
  },
  {
    id: 'a-lessons-10',
    name: 'Estudioso',
    description: null,
    criteriaType: 'lessons_completed',
    criteriaValue: 10,
    isActive: true,
    isRare: false,
  },
  {
    id: 'a-networth-12000',
    name: 'Primeiro Patrimônio',
    description: null,
    criteriaType: 'net_worth',
    criteriaValue: 12000,
    isActive: true,
    isRare: false,
  },
  {
    id: 'a-trades-1',
    name: 'Primeira Operação',
    description: null,
    criteriaType: 'trades_executed',
    criteriaValue: 1,
    isActive: true,
    isRare: false,
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
        assembliesParticipated: 0,
      },
    })
    const useCase = new CheckAndUnlockAchievementsUseCase(
      achievementRepository,
      progressSnapshotReader,
      createFakeAchievementMailer(),
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
        assembliesParticipated: 0,
      },
    })
    const useCase = new CheckAndUnlockAchievementsUseCase(
      achievementRepository,
      progressSnapshotReader,
      createFakeAchievementMailer(),
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
      createFakeAchievementMailer(),
    )

    const newlyUnlocked = await useCase.execute({ userId: 'u1' })

    expect(newlyUnlocked).toEqual([])
  })

  describe('aviso de conquista rara (EM.7.2)', () => {
    const snapshot = {
      netWorth: 0,
      streakDays: 0,
      lessonsCompleted: 0,
      tradesExecuted: 1,
      microDecisionsStreak: 0,
      tracksCompletedNoErrors: 0,
      lessonsReviewed: 0,
      assembliesParticipated: 0,
    }

    function setup(isRare: boolean) {
      const mailer = createFakeAchievementMailer()
      const useCase = new CheckAndUnlockAchievementsUseCase(
        createFakeAchievementRepository(
          catalog.map((a) => (a.id === 'a-trades-1' ? { ...a, isRare } : a)),
        ),
        createFakeProgressSnapshotReader({ u1: snapshot }),
        mailer,
      )
      return { mailer, useCase }
    }

    it('avisa quando a conquista recém-desbloqueada está marcada como rara no catálogo', async () => {
      const { mailer, useCase } = setup(true)

      await useCase.execute({ userId: 'u1' })

      expect(mailer.sent.map((s) => [s.userId, s.achievement.id])).toEqual([['u1', 'a-trades-1']])
    })

    it('não avisa quando a conquista não está marcada como rara, mesmo com poucos donos', async () => {
      const { mailer, useCase } = setup(false)

      await useCase.execute({ userId: 'u1' })

      expect(mailer.sent).toEqual([])
    })

    it('não avisa de novo numa conferência em que nada foi desbloqueado', async () => {
      const { mailer, useCase } = setup(true)

      await useCase.execute({ userId: 'u1' })
      await useCase.execute({ userId: 'u1' })

      expect(mailer.sent).toHaveLength(1)
    })

    it('falha no aviso nunca desfaz nem derruba o desbloqueio', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const repository = createFakeAchievementRepository(
        catalog.map((a) => (a.id === 'a-trades-1' ? { ...a, isRare: true } : a)),
      )
      const useCase = new CheckAndUnlockAchievementsUseCase(
        repository,
        createFakeProgressSnapshotReader({ u1: snapshot }),
        {
          sendRareUnlocked: async () => {
            throw new Error('outbox fora')
          },
        },
      )

      const unlocked = await useCase.execute({ userId: 'u1' })

      expect(unlocked.map((a) => a.id)).toEqual(['a-trades-1'])
      expect((await repository.listUnlockedForUser('u1')).map((u) => u.achievementId)).toEqual([
        'a-trades-1',
      ])
      spy.mockRestore()
    })
  })
})
