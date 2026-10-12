import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineAssetPriceSeriesReader } from './engineAssetPriceSeriesReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineAssetPriceSeriesReader', () => {
  it('GET /assets/quotes?days= e devolve só o mapa `series`', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ series: { a: [1, 2] } }),
    })

    const result =
      await createEngineAssetPriceSeriesReader('http://engine:8080').getRecentPrices(14)

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/assets/quotes?days=14')
    expect(result).toEqual({ a: [1, 2] })
  })
})
