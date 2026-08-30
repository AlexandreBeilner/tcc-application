import { describe, expect, it } from 'vitest'
import { createFakeNewsFeedReader } from '../../test/fakes/fakeNewsFeedReader'
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
    },
  ],
}

describe('ListNewsFeedUseCase', () => {
  it('repassa a query pra port e devolve o resultado', async () => {
    const newsFeedReader = createFakeNewsFeedReader(sampleResult)
    const useCase = new ListNewsFeedUseCase(newsFeedReader)

    const result = await useCase.execute({ limit: 5, offset: 10 })

    expect(result).toEqual(sampleResult)
    expect(newsFeedReader.calls).toEqual([{ limit: 5, offset: 10 }])
  })

  it('propaga erro lançado pela port', async () => {
    const newsFeedReader = createFakeNewsFeedReader(sampleResult)
    newsFeedReader.errorToThrow = new Error(
      'falha ao listar eventos macro no motor de simulação (status 500)',
    )
    const useCase = new ListNewsFeedUseCase(newsFeedReader)

    await expect(useCase.execute({})).rejects.toThrow(/falha ao listar eventos macro/)
  })
})
