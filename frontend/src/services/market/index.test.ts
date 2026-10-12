import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    cancelOrder,
    getAsset,
    getAssetBook,
    getAssetPriceSeries,
    getAssetQuotes,
    getCompany,
    getIndicatorHistory,
    getMarketCalendar,
    getMarketClock,
    getMyAccount,
    listAssets,
    listMyEvents,
    listMyOrders,
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

    it('listAssets pede sandbox só quando includeSandbox, combinável com type', async () => {
        const fetchMock = mockFetchOnce({ assets: [] })
        await listAssets('token', undefined, true)
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets?include_sandbox=true')

        const combined = mockFetchOnce({ assets: [] })
        await listAssets('token', 'acao', true)
        expect(combined.mock.calls[0][0]).toBe('/market/assets?type=acao&include_sandbox=true')
    })

    it('getAsset faz GET /market/assets/:id', async () => {
        const fetchMock = mockFetchOnce({ asset: { id: 'a1' } })
        await getAsset('token', 'a1')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets/a1')
    })

    it('getAssetBook faz GET /market/assets/:id/book', async () => {
        const fetchMock = mockFetchOnce({
            book: { is_sandbox: false, price: null, best_bid: 29.9, best_ask: 30.1, mid_price: 30, bids: null, asks: null },
        })
        await getAssetBook('token', 'a1')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets/a1/book')
    })

    it('getAssetQuotes repassa days quando informado', async () => {
        const fetchMock = mockFetchOnce({ quotes: [] })
        await getAssetQuotes('token', 'a1', 90)
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets/a1/quotes?days=90')
    })

    it('getAssetPriceSeries faz GET /market/assets/quotes, com days quando informado', async () => {
        const fetchMock = mockFetchOnce({ series: { a1: [1, 2] } })
        expect(await getAssetPriceSeries('token')).toEqual({ series: { a1: [1, 2] } })
        await getAssetPriceSeries('token', 14)
        expect(fetchMock.mock.calls[0][0]).toBe('/market/assets/quotes')
        expect(fetchMock.mock.calls[1][0]).toBe('/market/assets/quotes?days=14')
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

    it('getMarketClock faz GET /market/clock', async () => {
        const fetchMock = mockFetchOnce({ simulated_day: 5, market_open: false })
        await getMarketClock('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/clock')
    })

    it('getMarketCalendar faz GET /market/calendar com a janela em query string', async () => {
        const fetchMock = mockFetchOnce({ from_day: 1, to_day: 2, days: [] })
        await getMarketCalendar('token', '2026-01-05', '2026-01-19')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/calendar?from=2026-01-05&to=2026-01-19')
    })

    it('getMarketCalendar repassa scope e market_limit', async () => {
        const fetchMock = mockFetchOnce({ from_day: 1, to_day: 2, market_total: 0, market_shown: 0, days: [] })
        await getMarketCalendar('token', '2026-01-05', '2026-01-19', { scope: 'mine', marketLimit: 20 })
        expect(fetchMock.mock.calls[0][0]).toBe('/market/calendar?from=2026-01-05&to=2026-01-19&scope=mine&market_limit=20')
    })

    it('getMarketCalendar sem janela não manda query string', async () => {
        const fetchMock = mockFetchOnce({ from_day: 1, to_day: 2, days: [] })
        await getMarketCalendar('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/market/calendar')
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

    it('listMyOrders faz GET /market/orders', async () => {
        const fetchMock = mockFetchOnce({ orders: [] })
        await listMyOrders('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/market/orders')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('cancelOrder faz POST /market/orders/:id/cancel', async () => {
        const fetchMock = mockFetchOnce(undefined, 204)
        await cancelOrder('token', 'order-1')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/market/orders/order-1/cancel')
        expect(init.method).toBe('POST')
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
