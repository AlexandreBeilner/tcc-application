import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, setUnauthorizedHandler } from './client'

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
