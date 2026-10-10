import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getBillingStatus } from '../../services/billing'
import { listLeagues, respondToLeagueInvitation } from '../../services/leagues'
import type { LeagueSummary } from '../../services/leagues'
import { Ligas } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/billing', () => ({ getBillingStatus: vi.fn() }))
vi.mock('../../services/leagues', () => ({ listLeagues: vi.fn(), respondToLeagueInvitation: vi.fn(), createLeague: vi.fn() }))

const league = (overrides: Partial<LeagueSummary>): LeagueSummary => ({
    id: 'l1',
    name: 'Turma TCC',
    window: 'week',
    ownerId: 'o1',
    ownerUsername: 'dono',
    isOwner: false,
    status: 'active',
    archived: false,
    memberCount: 3,
    ...overrides,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Ligas />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Ligas (MO.5.2c)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        vi.mocked(getBillingStatus).mockResolvedValue({
            isPro: false,
            state: 'none',
            plan: null,
            store: null,
            expiresAt: null,
            willRenew: false,
            managementUrl: null,
            billingEnabled: true,
        })
    })
    afterEach(() => vi.clearAllMocks())

    it('lista as ligas em que participa, com período, pessoas e dono', async () => {
        vi.mocked(listLeagues).mockResolvedValue([league({}), league({ id: 'l2', name: 'Pausada', archived: true })])
        renderPage()

        const link = await screen.findByRole('link', { name: /Turma TCC/ })
        expect(link).toHaveAttribute('href', '/ligas/l1')
        expect(link).toHaveTextContent('Semanal · 3 pessoas · de @dono')
        expect(screen.getByText(/Pausada: volta quando o plano de quem criou/)).toBeInTheDocument()
    })

    it('convite pendente pode ser aceito sem plano PRO', async () => {
        vi.mocked(listLeagues).mockResolvedValue([league({ status: 'invited' })])
        vi.mocked(respondToLeagueInvitation).mockResolvedValue(undefined)
        renderPage()

        expect(await screen.findByText(/convidou você para a liga/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }))

        await waitFor(() => expect(respondToLeagueInvitation).toHaveBeenCalledWith('token', 'l1', true))
    })

    it('sem ligas explica como entrar, sem culpa nem escassez', async () => {
        vi.mocked(listLeagues).mockResolvedValue([])
        renderPage()
        expect(await screen.findByText(/Quando um amigo convidar você, o convite aparece aqui/)).toBeInTheDocument()
    })
})
