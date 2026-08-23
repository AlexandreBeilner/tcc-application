import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineMacroEventReader } from './engineMacroEventReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const sampleResult = {
  events: [
    {
      id: 'event-1',
      title: 'título',
      narrative: 'narrativa',
      direction: 'negativo',
      magnitude_band: 'moderado',
      affects_price: true,
      affects_fundamentals: true,
      status: 'pendente',
      triggered_on_day: 10,
      duration_days: 2,
    },
  ],
}

describe('engineMacroEventReader', () => {
  it('chama GET /macro-events no motor sem query string quando limit/offset ausentes', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => sampleResult })
    const reader = createEngineMacroEventReader('http://engine:8080')

    const result = await reader.list({})

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/macro-events')
    expect(result).toEqual(sampleResult)
  })

  it('repassa limit/offset como query string', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => sampleResult })
    const reader = createEngineMacroEventReader('http://engine:8080')

    await reader.list({ limit: 5, offset: 10 })

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/macro-events?limit=5&offset=10')
  })

  it('lança erro em qualquer falha do motor', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const reader = createEngineMacroEventReader('http://engine:8080')

    await expect(reader.list({})).rejects.toThrow(/falha ao listar eventos macro/)
  })
})
