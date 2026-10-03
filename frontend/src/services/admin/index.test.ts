import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    advanceTicks,
    cancelAdminOrder,
    cancelAdminOrdersBatch,
    listAdminOrders,
    getAdminOverview,
    getMarketMonitorAsset,
    getScheduler,
    getSystemHealth,
    listAuditLog,
    listMacroEvents,
    listMarketMonitor,
    listTicks,
    pauseScheduler,
    resumeScheduler,
    triggerMacroEvent,
    triggerTick,
} from '.'

function mockFetchOnce(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status, json: async () => body })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('services/admin', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('listMacroEvents sem parâmetros faz GET /admin/macro-events', async () => {
        const fetchMock = mockFetchOnce({ events: [], total_entries: 0 })
        await listMacroEvents('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/macro-events')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('listMacroEvents com limit/offset monta a query string', async () => {
        const fetchMock = mockFetchOnce({ events: [], total_entries: 0 })
        await listMacroEvents('token', 20, 40)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/macro-events?limit=20&offset=40')
    })

    it('triggerMacroEvent faz POST /admin/macro-events com o payload de template', async () => {
        const fetchMock = mockFetchOnce({ event: { id: 'e1' } }, 201)
        await triggerMacroEvent('token', { template_key: 'alta-minerio-ferro', targets: [{ sector: 'Mineração' }] })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/macro-events')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ template_key: 'alta-minerio-ferro', targets: [{ sector: 'Mineração' }] })
    })

    it('triggerMacroEvent faz POST /admin/macro-events com o payload avulso', async () => {
        const fetchMock = mockFetchOnce({ event: { id: 'e1' } }, 201)
        const input = {
            title: 'Título avulso',
            narrative: 'Narrativa avulsa',
            direction: 'negativo' as const,
            magnitude_band: 'leve' as const,
            affects_price: true,
            affects_fundamentals: false,
            targets: [{ asset_id: 'a1' }],
        }
        await triggerMacroEvent('token', input)
        const [, init] = fetchMock.mock.calls[0]
        expect(JSON.parse(init.body)).toEqual(input)
    })

    it('listAuditLog sem filtros faz GET /admin/audit-log', async () => {
        const fetchMock = mockFetchOnce({ entries: [], total_entries: 0 })
        await listAuditLog('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/audit-log')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('listAuditLog monta a query só com os filtros preenchidos', async () => {
        const fetchMock = mockFetchOnce({ entries: [], total_entries: 0 })
        await listAuditLog('token', { action: 'tick.trigger', result: undefined, limit: 20, offset: 40 })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/audit-log?action=tick.trigger&limit=20&offset=40')
    })

    it('getScheduler faz GET /admin/scheduler', async () => {
        const fetchMock = mockFetchOnce({ enabled: true })
        await getScheduler('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/scheduler')
    })

    it('pauseScheduler e resumeScheduler fazem POST nas rotas certas', async () => {
        const fetchMock = mockFetchOnce({ paused: true })
        await pauseScheduler('token')
        await resumeScheduler('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/scheduler/pause')
        expect(fetchMock.mock.calls[0][1].method).toBe('POST')
        expect(fetchMock.mock.calls[1][0]).toBe('/admin/scheduler/resume')
    })

    it('listTicks monta limit/offset', async () => {
        const fetchMock = mockFetchOnce({ ticks: [], total_entries: 0 })
        await listTicks('token', 20, 40)
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/ticks?limit=20&offset=40')
    })

    it('triggerTick faz POST /admin/tick', async () => {
        const fetchMock = mockFetchOnce({ day: 1 })
        await triggerTick('token')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/tick')
        expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    })

    it('advanceTicks faz POST /admin/tick/advance com { days }', async () => {
        const fetchMock = mockFetchOnce({ requested: 3, ticks: [] })
        await advanceTicks('token', 3)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/tick/advance')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ days: 3 })
    })

    it('getSystemHealth faz GET /admin/system/health com o token', async () => {
        const fetchMock = mockFetchOnce({ checked_at: '2026-10-03T12:00:00Z', components: [] })
        await getSystemHealth('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/system/health')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('getAdminOverview faz GET /admin/overview com o token', async () => {
        const fetchMock = mockFetchOnce({ market: null, scheduler: null, last_tick: null, users: null, errors: {} })
        await getAdminOverview('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/overview')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('listMarketMonitor faz GET /admin/market/assets com o token', async () => {
        const fetchMock = mockFetchOnce({ assets: [] })
        await listMarketMonitor('token')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/market/assets')
        expect(init.headers.Authorization).toBe('Bearer token')
    })

    it('getMarketMonitorAsset faz GET /admin/market/assets/:id', async () => {
        const fetchMock = mockFetchOnce({ asset_id: 'a1' })
        await getMarketMonitorAsset('token', 'a1')
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/market/assets/a1')
    })

    it('listAdminOrders monta a query só com os filtros definidos', async () => {
        const fetchMock = mockFetchOnce({ orders: [], total: 0 })
        await listAdminOrders('token', { status: 'open', asset_id: 'a1', side: undefined, limit: 50, offset: 100 })
        expect(fetchMock.mock.calls[0][0]).toBe('/admin/orders?status=open&asset_id=a1&limit=50&offset=100')
    })

    it('cancelAdminOrder faz POST /admin/orders/:id/cancel', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined })
        vi.stubGlobal('fetch', fetchMock)
        await cancelAdminOrder('token', 'ord-1')
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/orders/ord-1/cancel')
        expect(init.method).toBe('POST')
    })

    it('cancelAdminOrdersBatch faz POST com o filtro no corpo', async () => {
        const fetchMock = mockFetchOnce({ cancelled_count: 1, cancelled_ids: ['a'] })
        const result = await cancelAdminOrdersBatch('token', { asset_id: 'asset-1' })
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/admin/orders/cancel-batch')
        expect(JSON.parse(init.body)).toEqual({ asset_id: 'asset-1' })
        expect(result.cancelled_count).toBe(1)
    })
})
