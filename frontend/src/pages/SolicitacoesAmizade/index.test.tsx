import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listFriendRequests } from '../../services/friendships'
import { SolicitacoesAmizade } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/friendships', () => ({ listFriendRequests: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <SolicitacoesAmizade />
        </QueryClientProvider>,
    )
}

describe('SolicitacoesAmizade (tela 8.3)', () => {
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

    it('mostra recebidas e enviadas', async () => {
        vi.mocked(listFriendRequests).mockResolvedValue({
            received: [{ friendshipId: 'f1', userId: 'u2', username: 'bia', name: 'Bia Souza', createdAt: '2026-01-01' }],
            sent: [{ friendshipId: 'f2', userId: 'u3', username: 'caio', name: 'Caio Lima', createdAt: '2026-01-02' }],
        })

        renderPage()

        expect(await screen.findByText('Bia Souza')).toBeInTheDocument()
        expect(await screen.findByText('Caio Lima')).toBeInTheDocument()
    })

    it('erro ao carregar mostra mensagem, sem quebrar a tela', async () => {
        vi.mocked(listFriendRequests).mockRejectedValue(new Error('falha de rede'))

        renderPage()

        expect(
            await screen.findByText('Não foi possível carregar suas solicitações agora. Tente novamente em instantes.'),
        ).toBeInTheDocument()
    })
})
