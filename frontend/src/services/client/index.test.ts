import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiDownload, apiRequest, setUnauthorizedHandler } from '.'

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

    it('403 account_suspended em rota autenticada derruba a sessão como um 401', async () => {
        const handler = vi.fn()
        setUnauthorizedHandler(handler)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'account_suspended' }) }))

        await expect(apiRequest('/auth/me', { token: 'abc' })).rejects.toMatchObject({ status: 403 })
        expect(handler).toHaveBeenCalledTimes(1)
    })

    it('outro 403 não derruba a sessão, e account_suspended sem token (login) também não', async () => {
        const handler = vi.fn()
        setUnauthorizedHandler(handler)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'acesso restrito' }) }))
        await expect(apiRequest('/admin/ping', { token: 'abc' })).rejects.toBeInstanceOf(ApiError)

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'account_suspended' }) }))
        await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError)
        expect(handler).not.toHaveBeenCalled()
    })
})

describe('apiDownload (N.21)', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        setUnauthorizedHandler(null)
    })

    function stubFile(headers: Record<string, string>) {
        const blob = new Blob(['a,b\r\n'], { type: 'text/csv' })
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(headers),
            blob: async () => blob,
        })
        vi.stubGlobal('fetch', fetchMock)
        return { fetchMock, blob }
    }

    it('envia o Bearer e devolve o blob, o nome do arquivo e o que o backend informa nos cabeçalhos', async () => {
        const { fetchMock, blob } = stubFile({
            'Content-Disposition': 'attachment; filename="orders-20261006.csv"',
            'X-Export-Rows': '12',
            'X-Export-Truncated': 'true',
        })

        const file = await apiDownload('/admin/exports/orders', { token: 'tok' })

        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
        expect(file).toEqual({ blob, filename: 'orders-20261006.csv', rows: 12, truncated: true })
    })

    it('sem cabeçalhos usa um nome padrão, zero linhas e não truncado', async () => {
        stubFile({})
        const file = await apiDownload('/x', { token: 'tok' })
        expect(file).toMatchObject({ filename: 'exportacao.csv', rows: 0, truncated: false })
    })

    it('erro vira ApiError com a mensagem do backend; reauth_required não derruba a sessão, 401 comum derruba', async () => {
        const handler = vi.fn()
        setUnauthorizedHandler(handler)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'reauth_required' }) }))
        await expect(apiDownload('/x', { token: 'tok' })).rejects.toMatchObject({ status: 401, message: 'reauth_required' })
        expect(handler).not.toHaveBeenCalled()

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'token inválido' }) }))
        await expect(apiDownload('/x', { token: 'tok' })).rejects.toBeInstanceOf(ApiError)
        expect(handler).toHaveBeenCalledTimes(1)
    })
})
