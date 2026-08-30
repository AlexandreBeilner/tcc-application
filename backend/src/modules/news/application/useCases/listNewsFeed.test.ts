import { describe, expect, it } from 'vitest'
import { createFakeNewsFeedReader } from '../../test/fakes/fakeNewsFeedReader'
import { createFakeNewsReadRepository } from '../../test/fakes/fakeNewsReadRepository'
import { ListNewsFeedUseCase } from './listNewsFeed'

const sampleResult = {
  events: [
    {
      id: 'event-1',
      title: 'título',
      narrative: 'narrativa',
      direction: 'negativo',
      magnitude_band: 'leve',
      affects_price: true,
      affects_fundamentals: false,
      status: 'pendente',
      triggered_on_day: 5,
      duration_days: 1,
      targets: [{ sector: 'Financeiro' }],
      created_at: '2026-08-30T14:05:00.000Z',
    },
    {
      id: 'event-2',
      title: 'título 2',
      narrative: 'narrativa 2',
      direction: 'positivo',
      magnitude_band: 'moderado',
      affects_price: true,
      affects_fundamentals: false,
      status: 'aplicado',
      triggered_on_day: 4,
      duration_days: 1,
      targets: [],
      created_at: '2026-08-29T14:05:00.000Z',
    },
  ],
}

describe('ListNewsFeedUseCase', () => {
  it('repassa limit/offset (sem userId) pra port do motor', async () => {
    const newsFeedReader = createFakeNewsFeedReader(sampleResult)
    const newsReadRepository = createFakeNewsReadRepository()
    const useCase = new ListNewsFeedUseCase(newsFeedReader, newsReadRepository)

    await useCase.execute({ userId: 'user-1', limit: 5, offset: 10 })

    expect(newsFeedReader.calls).toEqual([{ limit: 5, offset: 10 }])
  })

  it('decora cada evento com seen, cruzando com a leitura do usuário', async () => {
    const newsFeedReader = createFakeNewsFeedReader(sampleResult)
    const newsReadRepository = createFakeNewsReadRepository([
      { userId: 'user-1', macroEventId: 'event-2' },
    ])
    const useCase = new ListNewsFeedUseCase(newsFeedReader, newsReadRepository)

    const result = await useCase.execute({ userId: 'user-1' })

    expect(result.events.map((e) => ({ id: e.id, seen: e.seen }))).toEqual([
      { id: 'event-1', seen: false },
      { id: 'event-2', seen: true },
    ])
    expect(newsReadRepository.listCalls).toEqual([
      { userId: 'user-1', macroEventIds: ['event-1', 'event-2'] },
    ])
  })

  it('propaga erro lançado pela port', async () => {
    const newsFeedReader = createFakeNewsFeedReader(sampleResult)
    newsFeedReader.errorToThrow = new Error(
      'falha ao listar eventos macro no motor de simulação (status 500)',
    )
    const newsReadRepository = createFakeNewsReadRepository()
    const useCase = new ListNewsFeedUseCase(newsFeedReader, newsReadRepository)

    await expect(useCase.execute({ userId: 'user-1' })).rejects.toThrow(
      /falha ao listar eventos macro/,
    )
  })
})
