import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, setUnauthorizedHandler } from '.'

describe('apiRequest', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        setUnauthorizedHandler(null)
    })

    it('retorna o corpo da resposta em caso de sucesso', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ user: { id: '1' } }),
            }),
        )

        const result = await apiRequest<{ user: { id: string } }>('/auth/me', { token: 'abc' })

        expect(result).toEqual({ user: { id: '1' } })
    })

    it('injeta Authorization: Bearer <token> quando um token é passado', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({}),
        })
        vi.stubGlobal('fetch', fetchMock)

        await apiRequest('/me/identities', { token: 'meu-token' })

        const [, init] = fetchMock.mock.calls[0]
        expect(init.headers.Authorization).toBe('Bearer meu-token')
    })

    it('lança ApiError com a mensagem de `{ error }` do backend em respostas 4xx', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 409,
                json: async () => ({ error: 'e-mail já cadastrado' }),
            }),
        )

        await expect(apiRequest('/auth/register', { method: 'POST', body: {} })).rejects.toMatchObject({
            status: 409,
            message: 'e-mail já cadastrado',
        })
    })

    it('carrega o corpo bruto do erro em `details`, mesmo com campos fora da convenção `{ error, details }` (tarefa J.3)', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 403,
                json: async () => ({ error: 'produto travado', key: 'asset:acao', unlockingLesson: { code: '2.3', title: 'x' } }),
            }),
        )

        await expect(apiRequest('/market/orders', { method: 'POST', body: {} })).rejects.toMatchObject({
            status: 403,
            details: { error: 'produto travado', key: 'asset:acao', unlockingLesson: { code: '2.3', title: 'x' } },
        })
    })

    it('chama o handler de 401 registrado, uma única vez, no ponto central', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({ error: 'token inválido' }),
            }),
        )

        const onUnauthorized = vi.fn()
        setUnauthorizedHandler(onUnauthorized)

        await expect(apiRequest('/auth/me', { token: 'expirado' })).rejects.toBeInstanceOf(ApiError)
        expect(onUnauthorized).toHaveBeenCalledOnce()
    })
})

describe('apiRequest, 401 que não encerra a sessão (N.22)', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        setUnauthorizedHandler(null)
    })

    function stub401(error: string) {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error }) }))
    }

    it('reauth_required não chama o handler de logout, mas lança ApiError 401', async () => {
        const handler = vi.fn()
        setUnauthorizedHandler(handler)
        stub401('reauth_required')

        await expect(apiRequest('/admin/tick', { method: 'POST', token: 'abc' })).rejects.toMatchObject({
            status: 401,
            message: 'reauth_required',
        })
        expect(handler).not.toHaveBeenCalled()
    })

    it('keepSessionOn401 também não chama o handler', async () => {
        const handler = vi.fn()
        setUnauthorizedHandler(handler)
        stub401('senha incorreta')

        await expect(apiRequest('/auth/reauth', { method: 'POST', token: 'abc', keepSessionOn401: true })).rejects.toBeInstanceOf(ApiError)
        expect(handler).not.toHaveBeenCalled()
    })
})
