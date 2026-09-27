import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEngineCatalogReader } from './engineCatalogReader'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('engineCatalogReader', () => {
  it('GET /assets sem query string quando type ausente', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineCatalogReader('http://engine:8080')

    await reader.listAssets()

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/assets')
  })

  it('GET /assets?type= quando type informado', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineCatalogReader('http://engine:8080')

    await reader.listAssets('acao')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/assets?type=acao')
  })

  it('GET /assets/:id', async () => {
    const asset = {
      id: 'asset-1',
      ticker: 'PETR4',
      name: 'Petrobras',
      type: 'acao',
      is_sandbox: false,
    }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => asset })
    const reader = createEngineCatalogReader('http://engine:8080')

    const result = await reader.getAsset('asset-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/assets/asset-1')
    expect(result).toEqual(asset)
  })

  it('GET /assets/:id/quotes?days= quando days informado', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    const reader = createEngineCatalogReader('http://engine:8080')

    await reader.getAssetQuotes('asset-1', 7)

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/assets/asset-1/quotes?days=7')
  })

  it('GET /companies/:id', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const reader = createEngineCatalogReader('http://engine:8080')

    await reader.getCompany('company-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/companies/company-1')
  })

  it('GET /assets/:id/book?user_id=', async () => {
    const book = { is_sandbox: false, price: null, best_bid: 10, best_ask: 10.5, mid_price: 10.25, bids: [], asks: [] }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => book })
    const reader = createEngineCatalogReader('http://engine:8080')

    const result = await reader.getAssetBook('asset-1', 'user-1')

    expect(fetchMock).toHaveBeenCalledWith('http://engine:8080/assets/asset-1/book?user_id=user-1')
    expect(result).toEqual(book)
  })

  it('traduz 404 do motor num EngineRequestError com a mensagem original', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'ativo não encontrado' }),
    })
    const reader = createEngineCatalogReader('http://engine:8080')

    await expect(reader.getAsset('inexistente')).rejects.toMatchObject({
      status: 404,
      message: 'ativo não encontrado',
    })
  })
})
