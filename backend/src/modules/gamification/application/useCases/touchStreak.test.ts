import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeProgressionRepository } from '../../test/fakes/fakeProgressionRepository'
import { AwardXpUseCase } from './awardXp'
import { TouchStreakUseCase } from './touchStreak'

function build() {
  const progressionRepository = createFakeProgressionRepository()
  const useCase = new TouchStreakUseCase(progressionRepository)
  return { progressionRepository, useCase }
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

    expect(result).toEqual({ currentStreak: 1, longestStreak: 1 })
  })

  it('chamar de novo no mesmo dia não infla o contador', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T08:00:00Z'))
    const { useCase } = build()
    await useCase.execute({ userId: 'u1' })

    vi.setSystemTime(new Date('2026-08-24T22:00:00Z'))
    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual({ currentStreak: 1, longestStreak: 1 })
  })

  it('avança em dia consecutivo e reseta após gap >= 2 dias', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const { useCase } = build()
    await useCase.execute({ userId: 'u1' })

    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
    const consecutive = await useCase.execute({ userId: 'u1' })
    expect(consecutive).toEqual({ currentStreak: 2, longestStreak: 2 })

    vi.setSystemTime(new Date('2026-08-28T12:00:00Z'))
    const afterGap = await useCase.execute({ userId: 'u1' })
    expect(afterGap).toEqual({ currentStreak: 1, longestStreak: 2 })
  })

  it('preserva xp/nível ao tocar o streak — não é dono desses campos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T12:00:00Z'))
    const { progressionRepository, useCase } = build()
    const awardXp = new AwardXpUseCase(progressionRepository)
    await awardXp.execute({ userId: 'u1', amount: 150, reason: 'licao' })

    await useCase.execute({ userId: 'u1' })

    const stored = await progressionRepository.findByUserId('u1')
    expect(stored?.xp).toBe(150)
    expect(stored?.level).toBe(2)
    expect(stored?.currentStreak).toBe(1)
  })
})
