import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listFriendRequests, listFriends, searchUsers } from '../../services/friendships'
import { BuscarAmigos } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/friendships', () => ({
    searchUsers: vi.fn(),
    listFriends: vi.fn(),
    listFriendRequests: vi.fn(),
}))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/', element: <BuscarAmigos /> },
            { path: '/perfil/:id', element: <div>perfil público</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('BuscarAmigos (tela 8.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true, avatarUrl: null },
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

    it('campo vazio não busca nada', () => {
        renderPage()
        expect(searchUsers).not.toHaveBeenCalled()
    })

    it('digitar busca (debounced) e mostra os resultados', async () => {
        vi.mocked(searchUsers).mockResolvedValue({
            users: [
                { id: 'u2', username: 'bia', name: 'Bia Souza', avatarUrl: null, cosmetics: { isPro: false, frame: null, title: null } },
            ],
        })

        renderPage()
        fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'bia' } })

        await waitFor(() => expect(searchUsers).toHaveBeenCalledWith('token', 'bia'), { timeout: 1000 })
        expect(await screen.findByText('Bia Souza')).toBeInTheDocument()
    })

    it('nenhum resultado mostra o estado vazio de UserSearchResults', async () => {
        vi.mocked(searchUsers).mockResolvedValue({ users: [] })

        renderPage()
        fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'zzz' } })

        expect(await screen.findByText('Nenhum usuário encontrado com esse nome de usuário.', {}, { timeout: 1000 })).toBeInTheDocument()
    })
})
