import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { dismissProInvite } from '../../../features/billing/proInviteDismissal'
import { resetReportedFunnel } from '../../../features/billing/useReportFunnel'
import { getBillingStatus, reportFunnelEvent } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { ProBenefitsCard } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))

const FREE: BillingStatus = {
    isPro: false,
    state: 'none',
    plan: null,
    store: null,
    expiresAt: null,
    willRenew: false,
    managementUrl: null,
    billingEnabled: true,
}

function renderCard(billing: Partial<BillingStatus> = {}) {
    vi.mocked(useAuth).mockReturnValue({ token: 't' } as ReturnType<typeof useAuth>)
    vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, ...billing })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <ProBenefitsCard />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('ProBenefitsCard (MO.9.8)', () => {
    beforeEach(() => {
        localStorage.clear()
        resetReportedFunnel()
    })
    afterEach(() => vi.clearAllMocks())

    it('lista os benefícios e leva aos planos, registrando a origem portfolio', async () => {
        renderCard()
        expect(await screen.findByRole('heading', { name: 'O que o PRO traz' })).toBeInTheDocument()
        expect(screen.getAllByRole('listitem')).toHaveLength(4)
        expect(screen.getByRole('link', { name: 'Ver planos' })).toHaveAttribute('href', '/planos')
        await waitFor(() => expect(reportFunnelEvent).toHaveBeenCalledWith('t', { event: 'invite_viewed', source: 'portfolio' }))
    })

    it('some ao dispensar e continua dispensado', async () => {
        renderCard()
        fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
        expect(screen.queryByRole('heading', { name: 'O que o PRO traz' })).toBeNull()
    })

    it('não aparece dentro dos 30 dias da dispensa', async () => {
        dismissProInvite('portfolio')
        renderCard()
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(screen.queryByRole('heading', { name: 'O que o PRO traz' })).toBeNull()
        expect(reportFunnelEvent).not.toHaveBeenCalled()
    })

    it('nunca aparece para PRO nem com a cobrança desligada', async () => {
        renderCard({ isPro: true, state: 'active' })
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(screen.queryByRole('heading', { name: 'O que o PRO traz' })).toBeNull()
    })

    it('com a cobrança desligada não mostra', async () => {
        renderCard({ billingEnabled: false })
        await waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(screen.queryByRole('heading', { name: 'O que o PRO traz' })).toBeNull()
    })
})
