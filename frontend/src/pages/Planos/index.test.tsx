import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { useWebPurchases } from '../../features/billing/useWebPurchases'
import { getBillingStatus } from '../../services/billing'
import type { BillingStatus } from '../../services/billing'
import type { WebPlan } from '../../features/billing/webPurchases'
import { Planos } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/billing', () => ({ getBillingStatus: vi.fn() }))
vi.mock('../../features/billing/useWebPurchases', () => ({ useWebPurchases: vi.fn() }))

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

const MONTHLY: WebPlan = { id: 'monthly', formattedPrice: 'R$ 19,97', amountMicros: 19_970_000, currency: 'BRL', handle: {} }
const ANNUAL: WebPlan = { id: 'annual', formattedPrice: 'R$ 199,97', amountMicros: 199_970_000, currency: 'BRL', handle: {} }

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Planos />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Planos (MO.3.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true, avatarUrl: null },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY, ANNUAL]), purchase: vi.fn() })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra os preços do Offering e o desconto do anual calculado', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderPage()

        expect(await screen.findByText('R$ 19,97')).toBeInTheDocument()
        expect(screen.getByText('R$ 199,97')).toBeInTheDocument()
        // 1 - 199,97 / (19,97 * 12) = 16,5% -> 17%
        expect(screen.getByText(/17% a menos/)).toBeInTheDocument()
        expect(screen.getByText('O que continua grátis')).toBeInTheDocument()
    })

    it('não mostra preço quando a cobrança está desligada', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, billingEnabled: false })
        renderPage()

        expect(await screen.findByText(/ainda não está disponível/)).toBeInTheDocument()
        expect(screen.queryByText('R$ 19,97')).not.toBeInTheDocument()
    })

    it('quem já é PRO vê o plano atual em vez da compra', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({
            ...FREE,
            isPro: true,
            state: 'active',
            plan: 'annual',
            store: 'stripe',
            expiresAt: '2027-03-01T12:00:00.000Z',
            willRenew: true,
        })
        renderPage()

        expect(await screen.findByText('Você já é PRO')).toBeInTheDocument()
        expect(screen.getByText(/Plano anual/)).toBeInTheDocument()
        expect(screen.queryByText('Escolha seu plano')).not.toBeInTheDocument()
    })

    it('mostra erro se o preço não carrega', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockRejectedValue(new Error('x')), purchase: vi.fn() })
        renderPage()

        expect(await screen.findByText(/Não foi possível carregar os preços/)).toBeInTheDocument()
    })
})
