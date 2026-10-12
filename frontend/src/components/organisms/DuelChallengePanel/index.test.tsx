import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { ApiError } from '../../../services/client'
import { createDuel } from '../../../services/duels'
import { DuelChallengePanel } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../../services/duels', () => ({ createDuel: vi.fn() }))
vi.mock('../../../services/friendships', () => ({
    listFriends: vi.fn().mockResolvedValue({
        friends: [
            {
                friendshipId: 'f1',
                userId: 'u2',
                username: 'bia',
                name: 'Bia',
                avatarUrl: null,
                cosmetics: { isPro: false, frame: null, title: null },
                friendsSince: '2026-01-01',
            },
            {
                friendshipId: 'f2',
                userId: 'u3',
                username: 'caio',
                name: 'Caio',
                avatarUrl: null,
                cosmetics: { isPro: false, frame: null, title: null },
                friendsSince: '2026-01-01',
            },
        ],
        page: 1,
        pageSize: 20,
        totalEntries: 2,
        totalPages: 1,
    }),
}))

const PRO: BillingStatus = {
    isPro: true,
    state: 'active',
    plan: 'monthly',
    store: 'stripe',
    expiresAt: null,
    willRenew: true,
    managementUrl: null,
    billingEnabled: true,
}

function renderPanel(busy: string[] = [], onCreated = vi.fn()) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <DuelChallengePanel busyUserIds={busy} onCreated={onCreated} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
    return onCreated
}

describe('DuelChallengePanel (MO.5.3)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('PRO desafia um amigo e é levado ao duelo', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(PRO)
        vi.mocked(createDuel).mockResolvedValue({ id: 'd9' } as never)
        const onCreated = renderPanel()

        const buttons = await screen.findAllByRole('button', { name: 'Desafiar' })
        expect(buttons).toHaveLength(2)
        fireEvent.click(buttons[0])

        await waitFor(() => expect(createDuel).toHaveBeenCalledWith('token', 'u2'))
        await waitFor(() => expect(onCreated).toHaveBeenCalledWith('d9'))
    })

    it('amigos com duelo aberto não aparecem como opção', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(PRO)
        renderPanel(['u2'])
        expect(await screen.findAllByRole('button', { name: 'Desafiar' })).toHaveLength(1)
        expect(screen.queryByText('Bia')).toBeNull()
    })

    it('quem não é PRO vê o convite e que aceitar é de graça, sem lista', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...PRO, isPro: false, state: 'none' })
        renderPanel()

        expect(await screen.findByText(/Aceitar o desafio de um amigo é sempre de graça/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Conhecer o PRO' })).toHaveAttribute('href', '/planos')
        expect(screen.queryByRole('button', { name: 'Desafiar' })).toBeNull()
    })

    it('cobrança desligada esconde o painel', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...PRO, isPro: false, state: 'none', billingEnabled: false })
        renderPanel()
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        await waitFor(() => expect(screen.queryByText('Desafiar um amigo')).toBeNull())
    })

    it('mostra o limite de 3 duelos dito pelo servidor', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(PRO)
        vi.mocked(createDuel).mockRejectedValue(
            new ApiError(409, 'você já tem 3 duelos em andamento; espere um terminar para desafiar de novo'),
        )
        renderPanel()

        fireEvent.click((await screen.findAllByRole('button', { name: 'Desafiar' }))[0])

        expect(await screen.findByRole('alert')).toHaveTextContent('espere um terminar')
    })
})
