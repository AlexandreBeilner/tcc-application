import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { listFriendRequests } from '../../../services/friendships'
import { FriendsBell } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/friendships', () => ({ listFriendRequests: vi.fn() }))

function renderBell() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/', element: <FriendsBell /> },
            { path: '/amigos', element: <div>hub de amigos</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const emptyRequests = {
    received: { items: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 },
    sent: { items: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 },
}

describe('FriendsBell (6.9.4)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('sem solicitações pendentes não mostra badge', async () => {
        vi.mocked(listFriendRequests).mockResolvedValue(emptyRequests)
        renderBell()

        expect(await screen.findByRole('link', { name: 'Amigos' })).toBeInTheDocument()
        expect(screen.queryByText(/\d/)).not.toBeInTheDocument()
    })

    it('mostra a contagem de solicitações recebidas pendentes', async () => {
        vi.mocked(listFriendRequests).mockResolvedValue({
            ...emptyRequests,
            received: { items: [], page: 1, pageSize: 20, totalEntries: 3, totalPages: 1 },
        })
        renderBell()

        expect(await screen.findByText('3')).toBeInTheDocument()
    })
})
