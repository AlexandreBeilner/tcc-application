import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureDiarioOrigin, reportDiarioOrigin } from '.'

describe('origem do Diário (DI.7.1)', () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))

    beforeEach(() => {
        sessionStorage.clear()
        fetchMock.mockClear()
        vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => vi.unstubAllGlobals())

    it('sem ?origem=diario na URL, nada é avisado', () => {
        captureDiarioOrigin('?modo=cadastro')
        captureDiarioOrigin('?origem=outra')
        reportDiarioOrigin('signup')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('com a origem capturada, o cadastro avisa só o evento, sem token nem credenciais', () => {
        captureDiarioOrigin('?origem=diario')
        reportDiarioOrigin('signup')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toMatch(/\/daily\/metrics$/)
        expect(JSON.parse(init.body as string)).toEqual({ event: 'signup' })
        expect(init.credentials).toBe('omit')
        expect(init.headers).not.toHaveProperty('Authorization')
    })

    it('a origem vale uma vez: cadastro e o login seguinte não contam duas vezes', () => {
        captureDiarioOrigin('?origem=diario')
        reportDiarioOrigin('signup')
        reportDiarioOrigin('login')
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('sem sessionStorage não lança', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('negado')
        })
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('negado')
        })
        expect(() => captureDiarioOrigin('?origem=diario')).not.toThrow()
        expect(() => reportDiarioOrigin('login')).not.toThrow()
        vi.restoreAllMocks()
    })
})
