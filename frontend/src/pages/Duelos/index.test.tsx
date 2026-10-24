import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listDuels, respondToDuel } from '../../services/duels'
import type { Duel } from '../../services/duels'
import { Duelos } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/duels', () => ({ listDuels: vi.fn(), respondToDuel: vi.fn(), createDuel: vi.fn() }))
vi.mock('../../services/friendships', () => ({
    listFriends: vi.fn().mockResolvedValue({ friends: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 }),
}))

const duel = (overrides: Partial<Duel>): Duel => ({
    id: 'd1',
    status: 'active',
    role: 'challenger',
    opponent: { id: 'u2', username: 'bia', name: 'Bia', avatarUrl: null, cosmetics: { frame: null, title: null } },
    createdAt: '2026-10-01T00:00:00Z',
    expiresAt: '2026-10-08T00:00:00Z',
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2026-10-08T00:00:00Z',
    finishedAt: null,
    result: null,
    reason: null,
    you: null,
    them: null,
    ...overrides,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Duelos />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Duelos (MO.5.3)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('separa em andamento, desafios enviados e histórico', async () => {
        vi.mocked(listDuels).mockResolvedValue([
            duel({ id: 'a', status: 'active' }),
            duel({ id: 's', status: 'pending', role: 'challenger' }),
            duel({ id: 'h', status: 'finished', result: 'won' }),
        ])
        renderPage()

        expect(await screen.findByText(/Em andamento até/)).toBeInTheDocument()
        expect(screen.getByText('Aguardando resposta')).toBeInTheDocument()
        expect(screen.getByText('Você venceu')).toBeInTheDocument()
    })

    it('convite recebido pode ser aceito', async () => {
        vi.mocked(listDuels).mockResolvedValue([duel({ id: 'i', status: 'pending', role: 'opponent' })])
        vi.mocked(respondToDuel).mockResolvedValue(undefined)
        renderPage()

        expect(await screen.findByText(/desafiou você para um duelo de 7 dias/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }))

        await waitFor(() => expect(respondToDuel).toHaveBeenCalledWith('token', 'i', true))
    })

    it('sem duelos explica como começar, sem culpa nem escassez', async () => {
        vi.mocked(listDuels).mockResolvedValue([])
        renderPage()
        expect(await screen.findByText(/Desafie um amigo ou aceite um convite/)).toBeInTheDocument()
    })

    it('derrota é dita sem humilhar', async () => {
        vi.mocked(listDuels).mockResolvedValue([duel({ status: 'finished', result: 'lost' })])
        renderPage()
        expect(await screen.findByText('Você não venceu desta vez')).toBeInTheDocument()
    })
})
