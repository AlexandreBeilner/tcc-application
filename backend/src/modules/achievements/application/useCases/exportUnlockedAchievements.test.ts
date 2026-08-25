import { describe, expect, it } from 'vitest'
import { createFakeAchievementRepository } from '../../test/fakes/fakeAchievementRepository'
import { ExportUnlockedAchievementsUseCase } from './exportUnlockedAchievements'

const catalog = [
  {
    id: 'a1',
    name: 'Primeira Semana',
    description: null,
    criteriaType: 'streak_days' as const,
    criteriaValue: 7,
  },
]

describe('ExportUnlockedAchievementsUseCase', () => {
  it('devolve as conquistas desbloqueadas do usuário', async () => {
    const repository = createFakeAchievementRepository(catalog)
    await repository.unlock('u1', 'a1')
    const useCase = new ExportUnlockedAchievementsUseCase(repository)

    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toHaveLength(1)
    expect(result[0].achievementId).toBe('a1')
  })

  it('lista vazia pra usuário sem nenhuma conquista desbloqueada', async () => {
    const repository = createFakeAchievementRepository(catalog)
    const useCase = new ExportUnlockedAchievementsUseCase(repository)

    expect(await useCase.execute({ userId: 'u1' })).toEqual([])
  })
})
