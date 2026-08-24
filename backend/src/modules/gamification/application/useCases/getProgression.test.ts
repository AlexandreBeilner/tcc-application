import { describe, expect, it } from 'vitest'
import { createFakeProgressionRepository } from '../../test/fakes/fakeProgressionRepository'
import { AwardXpUseCase } from './awardXp'
import { GetProgressionUseCase } from './getProgression'

describe('GetProgressionUseCase', () => {
  it('devolve xp=0/nível=1 pra usuário sem nenhum crédito ainda', async () => {
    const progressionRepository = createFakeProgressionRepository()
    const useCase = new GetProgressionUseCase(progressionRepository)

    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual({ userId: 'u1', xp: 0, level: 1 })
  })

  it('devolve a progressão persistida depois de um crédito de xp', async () => {
    const progressionRepository = createFakeProgressionRepository()
    const awardXp = new AwardXpUseCase(progressionRepository)
    const useCase = new GetProgressionUseCase(progressionRepository)
    await awardXp.execute({ userId: 'u1', amount: 150, reason: 'licao' })

    const result = await useCase.execute({ userId: 'u1' })

    expect(result).toEqual({ userId: 'u1', xp: 150, level: 2 })
  })
})
