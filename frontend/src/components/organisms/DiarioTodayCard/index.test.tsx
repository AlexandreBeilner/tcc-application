import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { useAuth } from '../../../features/auth/AuthContext'
import { DiarioTodayCard } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

function stub(today: object, me: object = { completed: false }) {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
        calls.push(url)
        return json(url.endsWith('/daily/today') ? today : me)
    })
    return calls
}

function renderCard() {
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <MemoryRouter initialEntries={['/']}>
                <Routes>
                    <Route path="/" element={<DiarioTodayCard />} />
                    <Route path="/diario" element={<p>pagina do diario</p>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const live = { status: 'live', game: { number: 9 } }

describe('DiarioTodayCard (DI.4.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as unknown as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.unstubAllGlobals())

    it('Diário no ar e ainda não jogado: mostra a chamada e leva ao jogo', async () => {
        stub(live)
        renderCard()
        fireEvent.click(await screen.findByRole('button', { name: /Diário de hoje/ }))
        expect(await screen.findByText('pagina do diario')).toBeTruthy()
    })

    it('já jogado hoje: some', async () => {
        const calls = stub(live, { completed: true })
        renderCard()
        await waitFor(() => expect(calls.some((c) => c.includes('/daily/9/me'))).toBe(true))
        await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
    })

    it('desligado ou agendado: nada aparece e o /me nem é consultado', async () => {
        const calls = stub({ status: 'scheduled', startDate: '2026-11-03', startsAt: '2026-11-03T00:00:00.000Z' })
        renderCard()
        await waitFor(() => expect(calls).toHaveLength(1))
        expect(screen.queryByRole('button')).toBeNull()
    })
})
