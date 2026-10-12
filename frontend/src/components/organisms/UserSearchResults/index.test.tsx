import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { acceptFriendRequest, sendFriendRequest } from '../../../services/friendships'
import type { Friend, FriendRequest, SearchedUser } from '../../../services/friendships'
import { UserSearchResults } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/friendships', () => ({ sendFriendRequest: vi.fn(), acceptFriendRequest: vi.fn() }))

function renderResults(
    results: SearchedUser[],
    overrides: { friends?: Friend[]; sentRequests?: FriendRequest[]; receivedRequests?: FriendRequest[] } = {},
) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <UserSearchResults
                        results={results}
                        currentUserId="u1"
                        friends={overrides.friends ?? []}
                        sentRequests={overrides.sentRequests ?? []}
                        receivedRequests={overrides.receivedRequests ?? []}
                    />
                ),
            },
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

const user: SearchedUser = {
    id: 'u2',
    username: 'bia',
    name: 'Bia Souza',
    avatarUrl: null,
    cosmetics: { isPro: false, frame: null, title: null },
}

describe('UserSearchResults (tela 8.2)', () => {
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

    it('nenhum resultado mostra mensagem de estado vazio', () => {
        renderResults([])
        expect(screen.getByText('Nenhum usuário encontrado com esse nome de usuário.')).toBeInTheDocument()
    })

    it('sem relação nenhuma mostra "Adicionar" e envia a solicitação ao clicar', async () => {
        vi.mocked(sendFriendRequest).mockResolvedValue({
            friendship: { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'pending', createdAt: '2026-01-01', respondedAt: null },
        })

        renderResults([user])

        fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

        await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith('token', 'bia'))
    })

    it('já amigos mostra "Amigos", sem botão de ação', () => {
        renderResults([user], {
            friends: [
                {
                    friendshipId: 'f0',
                    userId: 'u2',
                    username: 'bia',
                    name: 'Bia Souza',
                    avatarUrl: null,
                    cosmetics: { isPro: false, frame: null, title: null },
                    friendsSince: '2026-01-01',
                },
            ],
        })

        expect(screen.getByText('Amigos')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument()
    })

    it('solicitação já enviada mostra "Pendente"', () => {
        renderResults([user], {
            sentRequests: [
                {
                    friendshipId: 'f1',
                    userId: 'u2',
                    username: 'bia',
                    name: 'Bia Souza',
                    avatarUrl: null,
                    cosmetics: { isPro: false, frame: null, title: null },
                    createdAt: '2026-01-01',
                },
            ],
        })

        expect(screen.getByText('Pendente')).toBeInTheDocument()
    })

    it('pedido mútuo simultâneo (o outro já te pediu) mostra "Aceitar" em vez de "Adicionar"', async () => {
        vi.mocked(acceptFriendRequest).mockResolvedValue({
            friendship: {
                id: 'f1',
                requesterId: 'u2',
                addresseeId: 'u1',
                status: 'accepted',
                createdAt: '2026-01-01',
                respondedAt: '2026-01-02',
            },
        })

        renderResults([user], {
            receivedRequests: [
                {
                    friendshipId: 'f1',
                    userId: 'u2',
                    username: 'bia',
                    name: 'Bia Souza',
                    avatarUrl: null,
                    cosmetics: { isPro: false, frame: null, title: null },
                    createdAt: '2026-01-01',
                },
            ],
        })

        fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }))

        await waitFor(() => expect(acceptFriendRequest).toHaveBeenCalledWith('token', 'f1'))
    })

    it('o próprio usuário na lista (regressão da exclusão feita pelo backend) mostra "Você", sem botão de ação', () => {
        renderResults([{ id: 'u1', username: 'ana', name: 'Ana', avatarUrl: null, cosmetics: { isPro: false, frame: null, title: null } }])

        expect(screen.getByText('Você')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument()
    })

    it('clique no nome navega pro perfil público (8.4)', () => {
        renderResults([user])

        fireEvent.click(screen.getByRole('button', { name: /Bia Souza/ }))
        expect(screen.getByText('perfil público')).toBeInTheDocument()
    })
})
