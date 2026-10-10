import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getBillingStatus } from '../../../services/billing'
import type { BillingStatus } from '../../../services/billing'
import { PlanSection } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn() }))

const NONE: BillingStatus = {
    isPro: false,
    state: 'none',
    plan: null,
    store: null,
    expiresAt: null,
    willRenew: false,
    managementUrl: null,
    billingEnabled: true,
}

function renderSection() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <PlanSection />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('PlanSection (MO.3.3)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('assinante da App Store vê o destino da loja', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({
            ...NONE,
            isPro: true,
            state: 'active',
            plan: 'annual',
            store: 'app_store',
            expiresAt: '2027-03-15T12:00:00.000Z',
            willRenew: false,
        })
        renderSection()

        const link = await screen.findByRole('link', { name: 'Gerenciar na App Store' })
        expect(link).toHaveAttribute('href', 'https://apps.apple.com/account/subscriptions')
        expect(screen.getByText(/PRO até/)).toBeInTheDocument()
    })

    it('quem nunca assinou vê o convite para os planos', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(NONE)
        renderSection()

        expect(await screen.findByRole('link', { name: 'Conhecer o PRO' })).toHaveAttribute('href', '/planos')
    })

    it('some com a cobrança desligada e sem assinatura', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...NONE, billingEnabled: false })
        const { container } = renderSection()

        await vi.waitFor(() => expect(getBillingStatus).toHaveBeenCalled())
        expect(container).toBeEmptyDOMElement()
    })
})
