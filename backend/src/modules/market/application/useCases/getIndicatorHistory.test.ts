import { describe, expect, it } from 'vitest'
import { createFakeIndicatorHistoryReader } from '../../test/fakes/fakeIndicatorHistoryReader'
import { GetIndicatorHistoryUseCase } from './getIndicatorHistory'

describe('GetIndicatorHistoryUseCase', () => {
  it('repassa days pro IndicatorHistoryReader', async () => {
    const history = [
      { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.0037, ipca_accumulated_12m: 0.045 },
    ]
    const indicatorHistoryReader = createFakeIndicatorHistoryReader({ history })
    const useCase = new GetIndicatorHistoryUseCase(indicatorHistoryReader)

    const result = await useCase.execute({ days: 30 })

    expect(result).toEqual(history)
    expect(indicatorHistoryReader.getIndicatorHistoryCalls).toEqual([30])
  })

  it('days ausente repassa undefined (motor aplica o default)', async () => {
    const indicatorHistoryReader = createFakeIndicatorHistoryReader({ history: [] })
    const useCase = new GetIndicatorHistoryUseCase(indicatorHistoryReader)

    await useCase.execute({})

    expect(indicatorHistoryReader.getIndicatorHistoryCalls).toEqual([undefined])
  })
})
