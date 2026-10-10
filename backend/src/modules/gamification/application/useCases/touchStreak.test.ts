import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeAchievementChecker } from '../../test/fakes/fakeAchievementChecker'
import { createFakeProgressionRepository } from '../../test/fakes/fakeProgressionRepository'
import { AwardXpUseCase } from './awardXp'
import { TouchStreakUseCase } from './touchStreak'

function build() {
  const progressionRepository = createFakeProgressionRepository()
  const achievementChecker = createFakeAchievementChecker()
  const useCase = new TouchStreakUseCase(progressionRepository, achievementChecker)
  return { progressionRepository, achievementChecker, useCase }
}

describe('TouchStreakUseCase', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('primeira atividade do usuário inicia o streak em 1', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const { useCase } = build()

    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      milestoneReached: null,
      unlockedAchievements: [],
    })
  })

  it('chamar de novo no mesmo dia não infla o contador', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T08:00:00Z'))
    const { useCase } = build()
    await useCase.execute({ userId: 'u1' })

    vi.setSystemTime(new Date('2026-08-24T22:00:00Z'))
    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      milestoneReached: null,
      unlockedAchievements: [],
    })
  })

  it('avança em dia consecutivo e reseta após gap >= 2 dias', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const { useCase } = build()
    await useCase.execute({ userId: 'u1' })

    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
    const consecutive = await useCase.execute({ userId: 'u1' })
    expect(consecutive.currentStreak).toBe(2)
    expect(consecutive.longestStreak).toBe(2)
    expect(consecutive.milestoneReached).toBeNull()

    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    const afterGap = await useCase.execute({ userId: 'u1' })
    expect(afterGap.currentStreak).toBe(1)
    expect(afterGap.longestStreak).toBe(2)
    expect(afterGap.milestoneReached).toBeNull()
  })

  it('bater 7 dias consecutivos reporta o marco; o 8º dia não repete', async () => {
    vi.useFakeTimers()
    const { useCase } = build()
    const days = [
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
    ]
    const results = []
    for (const day of days) {
      vi.setSystemTime(new Date(`${day}T12:00:00Z`))
      results.push(await useCase.execute({ userId: 'u1' }))
    }

    expect(results.map((r) => r.milestoneReached)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      7,
      null,
    ])
  })

  it('checa conquistas depois de tocar o streak', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const { achievementChecker, useCase } = build()

    await useCase.execute({ userId: 'u1' })

    expect(achievementChecker.calls).toEqual(['u1'])
  })

  it('propaga as conquistas recém-desbloqueadas devolvidas pelo achievementChecker', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const { achievementChecker, useCase } = build()
    achievementChecker.nextResult = [{ id: 'a1', name: 'Primeira Semana', description: null }]

    const result = await useCase.execute({ userId: 'u1' })

    expect(result.unlockedAchievements).toEqual([
      { id: 'a1', name: 'Primeira Semana', description: null },
    ])
  })

  it('mantém o streak tocado mesmo se a checagem de conquistas falhar', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const progressionRepository = createFakeProgressionRepository()
    const achievementChecker = {
      calls: [] as string[],
      async checkAndUnlock(userId: string) {
        achievementChecker.calls.push(userId)
        throw new Error('engine indisponível')
      },
    }
    const useCase = new TouchStreakUseCase(progressionRepository, achievementChecker)

    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      milestoneReached: null,
      unlockedAchievements: [],
    })
  })

  it('preserva xp/nível ao tocar o streak — não é dono desses campos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const { progressionRepository, useCase } = build()
    const awardXp = new AwardXpUseCase(progressionRepository, createFakeAchievementChecker())
    await awardXp.execute({ userId: 'u1', amount: 150, reason: 'licao' })

    await useCase.execute({ userId: 'u1' })

    const stored = await progressionRepository.findByUserId('u1')
    expect(stored?.xp).toBe(150)
    expect(stored?.level).toBe(2)
    expect(stored?.currentStreak).toBe(1)
  })

  it('registra o dia de atividade (uma vez por dia) e falha no registro não derruba o streak', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const days: string[] = []
    const recorder = {
      async record(_userId: string, day: string) {
        days.push(day)
      },
    }
    const useCase = new TouchStreakUseCase(
      createFakeProgressionRepository(),
      createFakeAchievementChecker(),
      recorder,
    )
    await useCase.execute({ userId: 'u1' })
    expect(days).toEqual(['2026-08-24'])

    const failing = new TouchStreakUseCase(
      createFakeProgressionRepository(),
      createFakeAchievementChecker(),
      {
        async record() {
          throw new Error('banco fora')
        },
      },
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(failing.execute({ userId: 'u2' })).resolves.toMatchObject({ currentStreak: 1 })
  })
})
