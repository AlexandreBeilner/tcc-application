import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { removeFriendship, sendFriendRequest } from '../../../services/friendships'
import type { PublicProfile } from '../../../services/profile'
import { PublicProfileCard } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/friendships', () => ({ sendFriendRequest: vi.fn(), acceptFriendRequest: vi.fn(), removeFriendship: vi.fn() }))

function profile(overrides: Partial<PublicProfile> = {}): PublicProfile {
    return {
        username: 'bia',
        avatarUrl: null,
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

        expect(screen.queryByText('Este é o seu perfil')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument()
    })

    it('perfil do próprio usuário mostra ícone de editar só quando `onEdit` é passado (6.10.2)', () => {
        const onEdit = vi.fn()
        renderCard({ targetUserId: 'u1', onEdit })

        fireEvent.click(screen.getByRole('button', { name: 'Editar perfil' }))
        expect(onEdit).toHaveBeenCalledOnce()
    })

    it('perfil do próprio usuário sem `onEdit` não mostra o ícone de editar', () => {
        renderCard({ targetUserId: 'u1' })

        expect(screen.queryByRole('button', { name: 'Editar perfil' })).not.toBeInTheDocument()
    })

    it('amigo mostra "Desfazer amizade" com confirmação em duas etapas (6.9.3)', async () => {
        vi.mocked(removeFriendship).mockResolvedValue(undefined)
        renderCard({
            friends: [{ friendshipId: 'f9', userId: 'u2', username: 'bia', name: 'Bia', avatarUrl: null, friendsSince: '2026-01-01' }],
        })

        expect(screen.getByText('Amigos')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Desfazer amizade' }))
        expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
        await waitFor(() => expect(removeFriendship).toHaveBeenCalledWith('token', 'f9'))
    })
})
