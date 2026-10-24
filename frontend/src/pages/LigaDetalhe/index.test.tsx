import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { ApiError } from '../../services/client'
import { closeLeague, getLeague, inviteToLeague, leaveLeague } from '../../services/leagues'
import type { LeagueDetail } from '../../services/leagues'
import { LigaDetalhe } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/leagues', () => ({
    getLeague: vi.fn(),
    closeLeague: vi.fn(),
    leaveLeague: vi.fn(),
    inviteToLeague: vi.fn(),
    removeLeagueMember: vi.fn(),
    renameLeague: vi.fn(),
    respondToLeagueInvitation: vi.fn(),
}))
vi.mock('../../services/friendships', () => ({
    listFriends: vi.fn().mockResolvedValue({
        friends: [
            {
                friendshipId: 'f1',
                userId: 'amigo1',
                username: 'amigo1',
                name: 'Amigo Um',
                avatarUrl: null,
                cosmetics: { frame: null, title: null },
                friendsSince: '2026-01-01',
            },
        ],
        page: 1,
        pageSize: 20,
        totalEntries: 1,
        totalPages: 1,
    }),
}))

const NO_COSMETICS = { frame: null, title: null }

function detail(overrides: Partial<LeagueDetail['league']> = {}): LeagueDetail {
    return {
        league: {
            id: 'l1',
            name: 'Turma TCC',
            window: 'week',
            ownerId: 'u-dono',
            ownerUsername: 'dono',
            isOwner: false,
            status: 'active',
            memberCount: 2,
            ...overrides,
        },
        standings: [
            {
                position: 1,
                userId: 'u-dono',
                username: 'dono',
                name: 'Dono',
                avatarUrl: null,
                level: 3,
                profitabilityPct: 8,
                isYou: false,
                cosmetics: { frame: null, title: null },
            },
            {
                position: 2,
                userId: 'u-eu',
                username: 'eu',
                name: 'Eu',
                avatarUrl: null,
                level: 2,
                profitabilityPct: 1,
                isYou: true,
                cosmetics: NO_COSMETICS,
            },
        ],
        pendingInvites: [],
        updatedAt: null,
    }
}

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/ligas/l1']}>
                <Routes>
                    <Route path="/ligas/:id" element={<LigaDetalhe />} />
                    <Route path="/ligas" element={<p>lista de ligas</p>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('LigaDetalhe (MO.5.2c)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('membro gratuito vê a classificação, sem controles de dono, e pode sair', async () => {
        vi.mocked(getLeague).mockResolvedValue(detail())
        vi.mocked(leaveLeague).mockResolvedValue(undefined)
        renderPage()

        expect(await screen.findByText('+8,0%')).toBeInTheDocument()
        expect(screen.queryByText('Convidar amigos')).toBeNull()
        expect(screen.queryByRole('button', { name: 'Encerrar liga' })).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Sair da liga' }))
        fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

        await waitFor(() => expect(leaveLeague).toHaveBeenCalledWith('token', 'l1'))
        expect(await screen.findByText('lista de ligas')).toBeInTheDocument()
    })

    it('dono convida um amigo e encerra a liga com confirmação', async () => {
        vi.mocked(getLeague).mockResolvedValue(detail({ isOwner: true, ownerId: 'u-eu' }))
        vi.mocked(inviteToLeague).mockResolvedValue(undefined)
        vi.mocked(closeLeague).mockResolvedValue(undefined)
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Convidar' }))
        await waitFor(() => expect(inviteToLeague).toHaveBeenCalledWith('token', 'l1', 'amigo1'))

        fireEvent.click(screen.getByRole('button', { name: 'Encerrar liga' }))
        expect(screen.getByText(/Nada é apagado/)).toBeInTheDocument()
        fireEvent.click(screen.getAllByRole('button', { name: 'Encerrar liga' }).at(-1) as HTMLElement)
        await waitFor(() => expect(closeLeague).toHaveBeenCalledWith('token', 'l1'))
    })

    it('convidado vê o convite e ainda não vê a classificação', async () => {
        const invited = detail({ status: 'invited' })
        vi.mocked(getLeague).mockResolvedValue({ ...invited, standings: [] })
        renderPage()

        expect(await screen.findByText(/convidou você para esta liga/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument()
    })

    it('liga inexistente mostra mensagem amigável', async () => {
        vi.mocked(getLeague).mockRejectedValue(new ApiError(404, 'liga não encontrada'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Liga não encontrada')
    })
})
