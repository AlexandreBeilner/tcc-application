import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { acceptFriendRequest, removeFriendship } from '../../../services/friendships'
import type { FriendRequest } from '../../../services/friendships'
import { FriendRequestsPanel } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/friendships', () => ({ acceptFriendRequest: vi.fn(), removeFriendship: vi.fn() }))

function renderPanel(received: FriendRequest[], sent: FriendRequest[]) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <FriendRequestsPanel received={received} sent={sent} />
        </QueryClientProvider>,
    )
}

const received: FriendRequest = { friendshipId: 'f1', userId: 'u2', username: 'bia', name: 'Bia Souza', createdAt: '2026-01-01' }
const sent: FriendRequest = { friendshipId: 'f2', userId: 'u3', username: 'caio', name: 'Caio Lima', createdAt: '2026-01-02' }

describe('FriendRequestsPanel (tela 8.3)', () => {
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

    it('sem nenhuma solicitação mostra os dois estados vazios', () => {
        renderPanel([], [])
        expect(screen.getByText('Nenhuma solicitação recebida no momento.')).toBeInTheDocument()
        expect(screen.getByText('Nenhuma solicitação enviada no momento.')).toBeInTheDocument()
    })

    it('"Aceitar" numa solicitação recebida chama o accept com o id certo', async () => {
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

        renderPanel([received], [])
        fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }))

        await waitFor(() => expect(acceptFriendRequest).toHaveBeenCalledWith('token', 'f1'))
    })

    it('"Recusar" numa recebida e "Cancelar" numa enviada chamam o mesmo remove', async () => {
        vi.mocked(removeFriendship).mockResolvedValue(undefined)

        renderPanel([received], [sent])

        fireEvent.click(screen.getByRole('button', { name: 'Recusar' }))
        await waitFor(() => expect(removeFriendship).toHaveBeenCalledWith('token', 'f1'))

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        await waitFor(() => expect(removeFriendship).toHaveBeenCalledWith('token', 'f2'))
    })
})
