import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineIndicatorHistoryReader } from './engineIndicatorHistoryReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineIndicatorHistoryReader', () => {
  it('GET /market/indicators/history sem query string quando days ausente', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineIndicatorHistoryReader('http://engine:8080')

    await reader.getIndicatorHistory()

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/market/indicators/history')
  })

  it('GET /market/indicators/history?days= quando days informado', async () => {
    const history = [
      { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.0037, ipca_accumulated_12m: 0.045 },
    ]
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => history })
    const reader = createEngineIndicatorHistoryReader('http://engine:8080')

    const result = await reader.getIndicatorHistory(30)

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/market/indicators/history?days=30')
    expect(result).toEqual(history)
  })

  it('traduz um erro do motor num EngineRequestError com a mensagem original', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'days inválido' }),
    })
    const reader = createEngineIndicatorHistoryReader('http://engine:8080')

    await expect(reader.getIndicatorHistory(0)).rejects.toMatchObject({
      status: 400,
      message: 'days inválido',
    })
  })
})
