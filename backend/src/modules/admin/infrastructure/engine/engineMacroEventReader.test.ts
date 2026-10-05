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

  it('repassa a visão e os filtros do painel (N.11)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => sampleResult })
    const reader = createEngineMacroEventReader('http://engine:8080')

    await reader.list({ view: 'admin', status: 'cancelado', from_day: 10, to_day: 50 })

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      view: 'admin',
      status: 'cancelado',
      from_day: '10',
      to_day: '50',
    })
  })

  it('o feed do usuário não manda view (o motor assume a visão pública)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => sampleResult })
    await createEngineMacroEventReader('http://engine:8080').list({ limit: 20, offset: 0 })
    expect(fetchMock.mock.calls[0][0]).not.toContain('view')
  })

  it('lança erro em qualquer falha do motor', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const reader = createEngineMacroEventReader('http://engine:8080')

    await expect(reader.list({})).rejects.toThrow(/falha ao listar eventos macro/)
  })
})
