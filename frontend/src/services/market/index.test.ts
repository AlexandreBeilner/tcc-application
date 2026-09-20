import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    getAsset,
    getAssetQuotes,
    getCompany,
    getIndicatorHistory,
    getMyAccount,
    listAssets,
    listMyEvents,
    placeOrder,
    purchaseFixedIncome,
    redeemFixedIncome,
    simulateFixedIncome,
} from '.'

function mockFetchOnce(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status, json: async () => body })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('services/market', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('getMyAccount faz GET /market/me/account', async () => {
        const fetchMock = mockFetchOnce({ cashBalance: 100 })
        await getMyAccount('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/market/me/account')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('listAssets sem type lista o catálogo inteiro', async () => {
        const fetchMock = mockFetchOnce({ assets: [] })
        await listAssets('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets')
    })

    it('listAssets com type filtra por query string', async () => {
        const fetchMock = mockFetchOnce({ assets: [] })
        await listAssets('token', 'cdb')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets?type=cdb')
    })

    it('getAsset faz GET /market/assets/:id', async () => {
        const fetchMock = mockFetchOnce({ asset: { id: 'a1' } })
        await getAsset('token', 'a1')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets/a1')
    })

    it('getAssetQuotes repassa days quando informado', async () => {
        const fetchMock = mockFetchOnce({ quotes: [] })
        await getAssetQuotes('token', 'a1', 90)
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets/a1/quotes?days=90')
    })

    it('getIndicatorHistory sem days faz GET /market/indicators sem query', async () => {
        const fetchMock = mockFetchOnce({ indicators: [] })
        await getIndicatorHistory('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/indicators')
    })

    it('getIndicatorHistory repassa days quando informado', async () => {
        const fetchMock = mockFetchOnce({ indicators: [] })
        await getIndicatorHistory('token', 180)
        expect(fetchMock.mock.calls[0][0]).toBe('/market/indicators?days=180')
    })

    it('getCompany faz GET /market/companies/:id', async () => {
        const fetchMock = mockFetchOnce({ company: { id: 'c1' } })
        await getCompany('token', 'c1')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/companies/c1')
    })

    it('listMyEvents repassa limit/offset como query string', async () => {
        const fetchMock = mockFetchOnce({ events: [] })
        await listMyEvents('token', 20, 40)
        expect(fetchMock.mock.calls[0][0]).toBe('/market/me/events?limit=20&offset=40')
    })

    it('placeOrder faz POST /market/orders com o corpo em snake_case', async () => {
        const fetchMock = mockFetchOnce({ filled_quantity: 1, remaining_quantity: 0, fills: [] }, 201)
        await placeOrder('token', { asset_id: 'a1', side: 'buy', type: 'market', quantity: 10 })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/market/orders')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ asset_id: 'a1', side: 'buy', type: 'market', quantity: 10 })
    })

    it('simulateFixedIncome faz GET com query string', async () => {
        const fetchMock = mockFetchOnce({ unit_price: 1 })
        await simulateFixedIncome('token', { asset_id: 'a1', amount: 1000, days_held: 90 })
        expect(fetchMock.mock.calls[0][0]).toBe('/market/fixed-income/simulate?asset_id=a1&amount=1000&days_held=90')
    })

    it('purchaseFixedIncome faz POST /market/fixed-income/purchases', async () => {
        const fetchMock = mockFetchOnce({ unit_price: 1 }, 201)
        await purchaseFixedIncome('token', { asset_id: 'a1', amount: 500 })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/market/fixed-income/purchases')
        expect(JSON.parse(init.body)).toEqual({ asset_id: 'a1', amount: 500 })
    })

    it('redeemFixedIncome faz POST /market/fixed-income/redemptions', async () => {
        const fetchMock = mockFetchOnce({ total_value: 1 })
        await redeemFixedIncome('token', { asset_id: 'a1' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/market/fixed-income/redemptions')
        expect(JSON.parse(init.body)).toEqual({ asset_id: 'a1' })
    })
})
