import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { sendFriendRequest } from '../../../services/friendships'
import type { PublicProfile } from '../../../services/profile'
import { PublicProfileCard } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/friendships', () => ({ sendFriendRequest: vi.fn(), acceptFriendRequest: vi.fn() }))

function profile(overrides: Partial<PublicProfile> = {}): PublicProfile {
    return {
        username: 'bia',
        level: 4,
        xp: 820,
        currentStreak: 3,
        achievements: [],
        profitabilityPct: 5.2,
        window: 'week',
        ...overrides,
    }
}

function renderCard(props: Partial<Parameters<typeof PublicProfileCard>[0]> = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <PublicProfileCard
                profile={profile()}
                currentUserId="u1"
                targetUserId="u2"
                friends={[]}
                sentRequests={[]}
                receivedRequests={[]}
                {...props}
            />
        </QueryClientProvider>,
    )
}

describe('PublicProfileCard (tela 8.4)', () => {
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

    it('mostra rentabilidade, nível/xp e streak — nunca patrimônio absoluto', () => {
        renderCard()

        expect(screen.getByText('@bia')).toBeInTheDocument()
        expect(screen.getByText('Nível 4')).toBeInTheDocument()
        expect(screen.getByText('+5,2%')).toBeInTheDocument()
        expect(screen.getByText('820')).toBeInTheDocument()
        expect(screen.getByText(/3 dias/)).toBeInTheDocument()
        expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
    })

    it('lista as conquistas desbloqueadas recebidas', () => {
        renderCard({
            profile: profile({
                achievements: [{ id: 'a1', name: 'Primeira Semana', description: null, unlockedAt: '2026-02-01T00:00:00.000Z' }],
            }),
        })

        expect(screen.getByText('Primeira Semana')).toBeInTheDocument()
    })

    it('sem relação nenhuma mostra "Adicionar" e envia a solicitação', async () => {
        vi.mocked(sendFriendRequest).mockResolvedValue({
            friendship: { id: 'f1', requesterId: 'u1', addresseeId: 'u2', status: 'pending', createdAt: '2026-01-01', respondedAt: null },
        })

        renderCard()
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

        await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith('token', 'bia'))
    })

    it('perfil do próprio usuário não mostra botão de adicionar', () => {
        renderCard({ targetUserId: 'u1' })

        expect(screen.getByText('Este é o seu perfil.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument()
    })
})
