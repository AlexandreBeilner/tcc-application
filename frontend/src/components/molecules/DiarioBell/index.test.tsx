import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { DiarioBell } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

function renderBell(today: object, me: object = { completed: false }) {
    const fetchMock = vi.fn(async (url: string) => json(url.endsWith('/daily/today') ? today : me))
    vi.stubGlobal('fetch', fetchMock)
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter>
                <DiarioBell />
            </MemoryRouter>
        </QueryClientProvider>,
    )
    return fetchMock
}

const live = { status: 'live', game: { number: 9 } }

describe('DiarioBell (DI.4.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as unknown as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.unstubAllGlobals())

    it('jogo de hoje pendente: link para /diario com o aviso no nome acessível', async () => {
        renderBell(live)
        const link = await screen.findByRole('link', { name: 'Diário Selucra, jogo de hoje pendente' })
        expect(link).toHaveAttribute('href', '/diario')
    })

    it('já jogado: continua como link, sem o aviso de pendência', async () => {
        renderBell(live, { completed: true })
        expect(await screen.findByRole('link', { name: 'Diário Selucra' })).toHaveAttribute('href', '/diario')
    })

    it('desligado ou agendado: não aparece', async () => {
        const fetchMock = renderBell({ status: 'off' })
        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        expect(screen.queryByRole('link')).toBeNull()
    })
})
