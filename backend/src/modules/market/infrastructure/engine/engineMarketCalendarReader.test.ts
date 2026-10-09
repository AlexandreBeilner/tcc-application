import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineMarketCalendarReader } from './engineMarketCalendarReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineMarketCalendarReader', () => {
  it('GET /market/clock', async () => {
    const clock = { simulated_day: 5, market_open: false }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => clock })
    const reader = createEngineMarketCalendarReader('http://engine:8080')

    const result = await reader.getClock()

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/market/clock')
    expect(result).toEqual(clock)
  })

  it('GET /market/calendar sempre com o user_id, from e to só quando informados', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ days: [] }) })
    const reader = createEngineMarketCalendarReader('http://engine:8080')

    await reader.getCalendar('u-1', {})
    await reader.getCalendar('u-1', { from: '2026-01-05', to: '2026-01-11' })
    await reader.getCalendar('u-1', { scope: 'mine', market_limit: 0 })

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://engine:8080/market/calendar?user_id=u-1')
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://engine:8080/market/calendar?user_id=u-1&from=2026-01-05&to=2026-01-11',
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://engine:8080/market/calendar?user_id=u-1&scope=mine&market_limit=0',
    )
  })

  it('traduz um erro do motor num EngineRequestError com a mensagem original', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'janela inválida' }),
    })
    const reader = createEngineMarketCalendarReader('http://engine:8080')

    await expect(reader.getCalendar('u-1', {})).rejects.toMatchObject({
      status: 400,
      message: 'janela inválida',
    })
  })
})
