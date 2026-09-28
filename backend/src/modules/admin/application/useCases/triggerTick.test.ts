import { describe, expect, it } from 'vitest'
import { createFakeTickTrigger } from '../../test/fakes/fakeTickTrigger'
import { TriggerTickUseCase } from './triggerTick'

const sampleResult = {
  day: 10,
  selic_rate: 10.75,
  quotes_count: 24,
  fundamentals_count: 0,
  is_copom_day: false,
  is_report_day: false,
  dividends_generated_count: 0,
  dividends_paid_count: 0,
  bot_fills_count: 3,
  expired_orders_count: 0,
  uncovered_assets_count: 0,
  intraday_rounds_count: 2,
}

describe('TriggerTickUseCase', () => {
  it('chama a port e devolve o resultado', async () => {
    const tickTrigger = createFakeTickTrigger(sampleResult)
    const useCase = new TriggerTickUseCase(tickTrigger)

    const result = await useCase.execute()

    expect(result).toEqual(sampleResult)
    expect(tickTrigger.calls).toBe(1)
  })

  it('propaga erro lançado pela port (ex: TickInProgressError)', async () => {
    const tickTrigger = createFakeTickTrigger(sampleResult)
    tickTrigger.errorToThrow = new Error('já existe um tick em andamento')
    const useCase = new TriggerTickUseCase(tickTrigger)

    await expect(useCase.execute()).rejects.toThrow('já existe um tick em andamento')
  })
})
