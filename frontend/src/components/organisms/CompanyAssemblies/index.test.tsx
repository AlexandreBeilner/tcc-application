import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { listAssemblies, listCompanyProposals } from '../../../services/assemblies'
import { getBillingStatus } from '../../../services/billing'
import { ApiError } from '../../../services/client'
import { CompanyAssemblies } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/assemblies', () => ({ listAssemblies: vi.fn(), listCompanyProposals: vi.fn() }))
vi.mock('../../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))

function renderIt() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <CompanyAssemblies companyId="c1" />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('CompanyAssemblies (MO.6.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        vi.mocked(getBillingStatus).mockResolvedValue({
            isPro: true,
            state: 'active',
            plan: 'monthly',
            store: 'stripe',
            expiresAt: null,
            willRenew: true,
            managementUrl: null,
            billingEnabled: true,
        })
        vi.mocked(listCompanyProposals).mockResolvedValue({
            company: { id: 'c1', name: 'Acme', sector: 'Varejo' },
            isPro: true,
            holdsShares: true,
            cooldownDaysLeft: 0,
            blockedReason: null,
            limits: { monthlyCap: 3, usedThisMonth: 0, minSupport: 2, ttlDays: 30 },
            proposals: [],
            availableTemplates: [],
        })
    })
    afterEach(() => vi.clearAllMocks())

    it('sem assembleia ainda explica quando a próxima abre e mostra as propostas', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [], closed: [] })
        renderIt()
        expect(await screen.findByText(/Uma nova abre depois do próximo balanço da empresa/)).toBeInTheDocument()
        expect(await screen.findByRole('heading', { name: 'Propostas de pauta' })).toBeInTheDocument()
        expect(listAssemblies).toHaveBeenCalledWith('token', { companyId: 'c1', limit: 3 })
    })

    it('recurso desligado não renderiza nada na página da empresa', async () => {
        vi.mocked(listAssemblies).mockRejectedValue(new ApiError(404, 'x'))
        const { container } = renderIt()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(container).toBeEmptyDOMElement()
        expect(listCompanyProposals).not.toHaveBeenCalled()
    })
})
