import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TickInProgressError } from '../../domain/errors'
import { createEngineTickTrigger } from './engineTickTrigger'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

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

describe('engineTickTrigger', () => {
  it('chama POST /admin/tick no motor sem body', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => sampleResult })
    const trigger = createEngineTickTrigger('http://engine:8080')

    const result = await trigger.run()

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/admin/tick', { method: 'POST' })
    expect(result).toEqual(sampleResult)
  })

  it('traduz 409 do motor em TickInProgressError', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'já existe um tick em andamento' }),
    })
    const trigger = createEngineTickTrigger('http://engine:8080')

    await expect(trigger.run()).rejects.toThrow(TickInProgressError)
  })

  it('lança erro genérico em qualquer outra falha do motor', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const trigger = createEngineTickTrigger('http://engine:8080')

    await expect(trigger.run()).rejects.toThrow(/falha ao executar tick/)
  })
})
