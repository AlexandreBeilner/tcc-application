import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeOnboarding, getCurrentUser, login, register } from '.'

describe('api/auth', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('register faz POST /auth/register com o payload de cadastro', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => ({ token: 'jwt', user: { id: '1' } }),
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await register({
            name: 'Ana',
            email: 'ana@example.com',
            username: 'ana',
            password: 'senha1234',
        })

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/auth/register')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({
            name: 'Ana',
            email: 'ana@example.com',
            username: 'ana',
            password: 'senha1234',
        })
        expect(result).toEqual({ token: 'jwt', user: { id: '1' } })
    })

    it('login faz POST /auth/login com e-mail e senha', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ token: 'jwt', user: { id: '1' } }),
        })
        vi.stubGlobal('fetch', fetchMock)

        await login({ email: 'ana@example.com', password: 'senha1234' })

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/auth/login')
        expect(JSON.parse(init.body)).toEqual({ email: 'ana@example.com', password: 'senha1234' })
    })

    it('getCurrentUser faz GET /auth/me com Bearer token', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ user: { id: '1' } }),
        })
        vi.stubGlobal('fetch', fetchMock)

        await getCurrentUser('meu-token')

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/auth/me')
        expect(init.headers.Authorization).toBe('Bearer meu-token')
    })

    it('completeOnboarding faz PATCH /me com onboardingCompleted: true', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ user: { id: '1', onboardingCompleted: true } }),
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await completeOnboarding('meu-token')

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/me')
        expect(init.method).toBe('PATCH')
        expect(JSON.parse(init.body)).toEqual({ onboardingCompleted: true })
        expect(init.headers.Authorization).toBe('Bearer meu-token')
        expect(result.user.onboardingCompleted).toBe(true)
    })
})
