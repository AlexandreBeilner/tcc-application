import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleMarketOverview } from '../../test/fakes/fakeMarketOverviewReader'
import { createEngineMarketOverviewReader } from './engineMarketOverviewReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineMarketOverviewReader', () => {
  it('chama GET /admin/overview com prazo e devolve o corpo', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => sampleMarketOverview })

    const result = await createEngineMarketOverviewReader('http://engine:8080').get()

    expect(result).toEqual(sampleMarketOverview)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://engine:8080/admin/overview')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('rejeita com o status quando o motor responde erro', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })

    await expect(createEngineMarketOverviewReader('http://engine:8080').get()).rejects.toThrow(
      'status 503',
    )
  })
})
