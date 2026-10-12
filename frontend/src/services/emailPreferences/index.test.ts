import { afterEach, describe, expect, it, vi } from 'vitest'
import { getEmailPreferences, unsubscribeByToken, updateEmailPreferences } from '.'

function stubFetch(body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('services/emailPreferences', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('getEmailPreferences faz GET /me/email-preferences com o token', async () => {
        const fetchMock = stubFetch({ preferences: { social: false, engagement: false }, suppression: null })

        const result = await getEmailPreferences('tk')

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/me/email-preferences')
        expect(init.headers.Authorization).toBe('Bearer tk')
        expect(result.preferences).toEqual({ social: false, engagement: false })
    })

    it('updateEmailPreferences faz PATCH só com as categorias alteradas', async () => {
        const fetchMock = stubFetch({ preferences: { social: false, engagement: true } })

        await updateEmailPreferences('tk', { engagement: true })

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/me/email-preferences')
        expect(init.method).toBe('PATCH')
        expect(JSON.parse(init.body)).toEqual({ engagement: true })
    })

    it('unsubscribeByToken faz POST /email/unsubscribe sem Authorization', async () => {
        const fetchMock = stubFetch({ status: 'cancelado', category: 'social' })

        const result = await unsubscribeByToken('abc')

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe('/email/unsubscribe')
        expect(init.method).toBe('POST')
        expect(init.headers.Authorization).toBeUndefined()
        expect(JSON.parse(init.body)).toEqual({ token: 'abc' })
        expect(result.category).toBe('social')
    })
})
