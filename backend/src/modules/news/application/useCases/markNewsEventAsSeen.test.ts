import { describe, expect, it } from 'vitest'
import { createFakeNewsReadRepository } from '../../test/fakes/fakeNewsReadRepository'
import { MarkNewsEventAsSeenUseCase } from './markNewsEventAsSeen'

describe('MarkNewsEventAsSeenUseCase', () => {
  it('marca o evento como visto pro usuário', async () => {
    const newsReadRepository = createFakeNewsReadRepository()
    const useCase = new MarkNewsEventAsSeenUseCase(newsReadRepository)

    await useCase.execute({ userId: 'user-1', macroEventId: 'event-1' })

    expect(newsReadRepository.markCalls).toEqual([{ userId: 'user-1', macroEventId: 'event-1' }])
  })

  it('idempotente — reenviar não lança erro', async () => {
    const newsReadRepository = createFakeNewsReadRepository([
      { userId: 'user-1', macroEventId: 'event-1' },
    ])
    const useCase = new MarkNewsEventAsSeenUseCase(newsReadRepository)

    await expect(
      useCase.execute({ userId: 'user-1', macroEventId: 'event-1' }),
    ).resolves.toBeUndefined()
  })
})
