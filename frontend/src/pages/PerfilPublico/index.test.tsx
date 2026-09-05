import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listFriendRequests, listFriends } from '../../services/friendships'
import { getUserProfile } from '../../services/profile'
import { PerfilPublico } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/friendships', () => ({ listFriends: vi.fn(), listFriendRequests: vi.fn() }))
vi.mock('../../services/profile', () => ({ getUserProfile: vi.fn() }))

function renderPage(id = 'u2') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/perfil/:id', element: <PerfilPublico /> }], { initialEntries: [`/perfil/${id}`] })
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('PerfilPublico (tela 8.4)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listFriends).mockResolvedValue({ friends: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 })
        vi.mocked(listFriendRequests).mockResolvedValue({
            received: { items: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 },
            sent: { items: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 },
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra o perfil público carregado', async () => {
        vi.mocked(getUserProfile).mockResolvedValue({
            profile: { username: 'bia', level: 4, xp: 820, currentStreak: 3, achievements: [], profitabilityPct: 5.2, window: 'week' },
        })

        renderPage('u2')

        expect(await screen.findByText('@bia')).toBeInTheDocument()
        expect(getUserProfile).toHaveBeenCalledWith('token', 'u2')
    })

    it('id inexistente (404) mostra mensagem de erro, sem quebrar a tela', async () => {
        vi.mocked(getUserProfile).mockRejectedValue(new Error('usuário não encontrado'))

        renderPage('inexistente')

        expect(await screen.findByText('Não foi possível carregar este perfil agora. Tente novamente em instantes.')).toBeInTheDocument()
    })
})
