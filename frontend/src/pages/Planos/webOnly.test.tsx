import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlanSection } from '../../components/organisms/PlanSection'
import { useAuth } from '../../features/auth/AuthContext'
import { useWebPurchases } from '../../features/billing/useWebPurchases'
import { getBillingStatus } from '../../services/billing'
import type { BillingStatus } from '../../services/billing'
import type { WebPlan } from '../../features/billing/webPurchases'
import { Planos } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))
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
const PRO_WEB: BillingStatus = { ...FREE, isPro: true, state: 'active', plan: 'monthly', store: 'stripe', willRenew: true }
const MONTHLY: WebPlan = { id: 'monthly', formattedPrice: 'R$ 19,97', amountMicros: 19_970_000, currency: 'BRL', handle: {} }

const STORE_TEXT = /App Store|Google Play|Restaurar compras/i

function renderWithClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>,
    )
}

// LW.1.3: na web (navegador e PWA instalado) nenhum caminho oferece compra por loja.
describe.each([
    ['navegador', false],
    ['PWA instalado (display-mode: standalone)', true],
])('web sem caminho de loja, %s (LW.1.3)', (_label, standalone) => {
    beforeEach(() => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn().mockImplementation((query: string) => ({ matches: standalone && query.includes('standalone'), media: query })),
        )
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        vi.mocked(useWebPurchases).mockReturnValue({ loadPlans: vi.fn().mockResolvedValue([MONTHLY]), purchase: vi.fn() })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('Planos para quem ainda não assina', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
        renderWithClient(<Planos />)

        expect(await screen.findByText('R$ 19,97')).toBeInTheDocument()
        expect(document.body.textContent).not.toMatch(STORE_TEXT)
        expect(screen.queryByRole('button', { name: /restaurar/i })).not.toBeInTheDocument()
    })

    it('Planos para quem assina pela web', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(PRO_WEB)
        renderWithClient(<Planos />)

        expect(await screen.findByText('Você já é PRO')).toBeInTheDocument()
        expect(document.body.textContent).not.toMatch(STORE_TEXT)
    })

    it('PlanSection (Configurações)', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue(PRO_WEB)
        renderWithClient(<PlanSection />)

        await screen.findByText(/PRO/)
        expect(document.body.textContent).not.toMatch(STORE_TEXT)
    })
})
