import { afterEach, describe, expect, it, vi } from 'vitest'
import { listMacroEvents, triggerMacroEvent } from '.'

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
})
