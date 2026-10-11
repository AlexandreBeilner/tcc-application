import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listFriendRequests, listFriends } from '../../services/friendships'
import { getSocialFeed } from '../../services/socialfeed'
import { Amigos } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/friendships', () => ({ listFriends: vi.fn(), listFriendRequests: vi.fn() }))
vi.mock('../../services/socialfeed', () => ({ getSocialFeed: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/', element: <Amigos /> },
            { path: '/amigos/buscar', element: <div>tela de busca</div> },
            { path: '/amigos/solicitacoes', element: <div>tela de solicitações</div> },
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

describe('Amigos (tela 8.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getSocialFeed).mockResolvedValue({ events: [] })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra o contador de solicitações recebidas e navega pra Buscar/Solicitações', async () => {
        vi.mocked(listFriends).mockResolvedValue({
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
            page: 1,
            pageSize: 20,
            totalEntries: 1,
            totalPages: 1,
        })
        vi.mocked(listFriendRequests).mockResolvedValue({
            received: {
                items: [
                    {
                        friendshipId: 'f1',
                        userId: 'u3',
                        username: 'caio',
                        name: 'Caio',
                        avatarUrl: null,
                        cosmetics: { isPro: false, frame: null, title: null },
                        createdAt: '2026-01-01',
                    },
                ],
                page: 1,
                pageSize: 20,
                totalEntries: 1,
                totalPages: 1,
            },
            sent: { items: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 },
        })

        renderPage()

        expect(await screen.findByText('Bia Souza')).toBeInTheDocument()
        expect(await screen.findByText('Solicitações (1)')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Buscar amigos'))
        expect(screen.getByText('tela de busca')).toBeInTheDocument()
    })

    it('erro ao carregar mostra mensagem, sem quebrar a tela', async () => {
        vi.mocked(listFriends).mockRejectedValue(new Error('falha de rede'))
        vi.mocked(listFriendRequests).mockResolvedValue(emptyRequests)

        renderPage()

        expect(await screen.findByText('Não foi possível carregar seus amigos agora. Tente novamente em instantes.')).toBeInTheDocument()
    })

    it('mostra a atividade recente dos amigos (backlog engajamento G.2), estado vazio quando não há eventos', async () => {
        vi.mocked(listFriends).mockResolvedValue({ friends: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 })
        vi.mocked(listFriendRequests).mockResolvedValue(emptyRequests)

        renderPage()

        expect(await screen.findByText('Atividade recente')).toBeInTheDocument()
        expect(
            screen.getByText(
                'Quando seus amigos concluírem uma trilha, vencerem um duelo ou participarem de uma assembleia, aparece por aqui.',
            ),
        ).toBeInTheDocument()
    })

    it('lista eventos de trilha concluída de amigos na seção de atividade recente', async () => {
        vi.mocked(listFriends).mockResolvedValue({ friends: [], page: 1, pageSize: 20, totalEntries: 0, totalPages: 1 })
        vi.mocked(listFriendRequests).mockResolvedValue(emptyRequests)
        vi.mocked(getSocialFeed).mockResolvedValue({
            events: [
                {
                    type: 'track_completed',
                    trackNumber: 1,
                    duel: null,
                    assembly: null,
                    occurredAt: '2026-02-10T00:00:00.000Z',
                    userId: 'u2',
                    username: 'bia',
                    name: 'Bia Souza',
                    avatarUrl: null,
                    cosmetics: { isPro: false, frame: null, title: null },
                },
            ],
        })

        renderPage()

        expect(await screen.findByText(/completou a Trilha 1: Renda Fixa/)).toBeInTheDocument()
    })
})
