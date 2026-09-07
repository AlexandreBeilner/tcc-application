import { describe, expect, it } from 'vitest'
import { InvalidXpAmountError } from '../../domain/errors'
import { createFakeAchievementChecker } from '../../test/fakes/fakeAchievementChecker'
import { createFakeProgressionRepository } from '../../test/fakes/fakeProgressionRepository'
import { AwardXpUseCase } from './awardXp'

function build() {
  const progressionRepository = createFakeProgressionRepository()
  const achievementChecker = createFakeAchievementChecker()
  const useCase = new AwardXpUseCase(progressionRepository, achievementChecker)
  return { progressionRepository, achievementChecker, useCase }
}

describe('AwardXpUseCase', () => {
  it('credita xp e calcula nível pra usuário sem progressão ainda', async () => {
    const { useCase } = build()

    const result = await useCase.execute({ userId: 'u1', amount: 50, reason: 'licao' })

    expect(result).toEqual({ xp: 50, level: 1, leveledUp: false, unlockedAchievements: [] })
  })

  it('acumula xp em créditos sucessivos, nunca escrevendo direto no repositório', async () => {
    const { progressionRepository, useCase } = build()

    await useCase.execute({ userId: 'u1', amount: 60, reason: 'licao' })
    const result = await useCase.execute({ userId: 'u1', amount: 60, reason: 'missao' })

    expect(result.xp).toBe(120)
    const stored = await progressionRepository.findByUserId('u1')
    expect(stored).toEqual({
      userId: 'u1',
      xp: 120,
      level: 2,
      currentStreak: 0,
      longestStreak: 0,
      lastQualifyingActivityDate: null,
    })
  })

  it('sinaliza leveledUp ao cruzar o limiar do próximo nível', async () => {
    const { useCase } = build()
    await useCase.execute({ userId: 'u1', amount: 90, reason: 'licao' })

    const result = await useCase.execute({ userId: 'u1', amount: 20, reason: 'missao' })

    expect(result).toEqual({ xp: 110, level: 2, leveledUp: true, unlockedAchievements: [] })
  })

  it('sobe 2+ níveis de uma vez num crédito grande, nível sempre recalculado do zero', async () => {
    const { useCase } = build()

    const result = await useCase.execute({ userId: 'u1', amount: 700, reason: 'bonus' })

    expect(result).toEqual({ xp: 700, level: 4, leveledUp: true, unlockedAchievements: [] })
  })

  it('checa conquistas depois de creditar xp', async () => {
    const { achievementChecker, useCase } = build()

    await useCase.execute({ userId: 'u1', amount: 50, reason: 'licao' })

    expect(achievementChecker.calls).toEqual(['u1'])
  })

  it('propaga as conquistas recém-desbloqueadas devolvidas pelo achievementChecker', async () => {
    const { achievementChecker, useCase } = build()
    achievementChecker.nextResult = [{ id: 'a1', name: 'Primeiros Passos', description: null }]

    const result = await useCase.execute({ userId: 'u1', amount: 50, reason: 'licao' })

    expect(result.unlockedAchievements).toEqual([
      { id: 'a1', name: 'Primeiros Passos', description: null },
    ])
  })

  it('rejeita quantidade não positiva', async () => {
    const { useCase } = build()

    await expect(useCase.execute({ userId: 'u1', amount: 0, reason: 'x' })).rejects.toBeInstanceOf(
      InvalidXpAmountError,
    )
    await expect(
      useCase.execute({ userId: 'u1', amount: -10, reason: 'x' }),
    ).rejects.toBeInstanceOf(InvalidXpAmountError)
  })
})
