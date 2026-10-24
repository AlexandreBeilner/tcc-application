import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { listCompanyProposals, proposeAgenda, supportProposal, withdrawProposalSupport } from '../../../services/assemblies'
import type { CompanyProposals, ProposalView } from '../../../services/assemblies'
import { ApiError } from '../../../services/client'
import { ProposalsPanel } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/assemblies', () => ({
    listCompanyProposals: vi.fn(),
    proposeAgenda: vi.fn(),
    supportProposal: vi.fn(),
    withdrawProposalSupport: vi.fn(),
}))

const proposal = (over: Partial<ProposalView> = {}): ProposalView => ({
    id: 'p1',
    templateKey: 'debt_policy',
    title: 'Política de endividamento',
    description: 'Quanto a empresa deve se endividar.',
    options: [
        { label: 'Alavancar', gain: 'Mais fôlego', loss: 'Mais risco' },
        { label: 'Reduzir', gain: 'Menos risco', loss: 'Menos fôlego' },
    ],
    supportCount: 1,
    supportedByMe: false,
    proposedByMe: false,
    expiresAt: '2099-01-01T00:00:00Z',
    queuePosition: null,
    ...over,
})

const base = (over: Partial<CompanyProposals> = {}): CompanyProposals => ({
    company: { id: 'c1', name: 'Acme', sector: 'Varejo' },
    holdsShares: true,
    cooldownDaysLeft: 0,
    blockedReason: null,
    limits: { monthlyCap: 3, usedThisMonth: 1, minSupport: 2, ttlDays: 30 },
    proposals: [proposal()],
    availableTemplates: [
        { key: 'debt_policy', title: 'Política de endividamento', description: 'd', hasActiveProposal: true },
        { key: 'capital_budget', title: 'Orçamento de capital', description: 'd', hasActiveProposal: false },
    ],
    ...over,
})

function renderPanel() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <ProposalsPanel companyId="c1" />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('ProposalsPanel (MO.6.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('acionista apoia, retira apoio e propõe pauta que ainda não está na fila', async () => {
        vi.mocked(listCompanyProposals).mockResolvedValue(base())
        vi.mocked(supportProposal).mockResolvedValue({ proposal: {} as never, alreadySupported: false })
        vi.mocked(proposeAgenda).mockResolvedValue({ proposal: {} as never, joinedExisting: false })
        renderPanel()

        expect(await screen.findByText(/1 apoio · Faltam 1 apoio para entrar na fila/)).toBeInTheDocument()
        expect(screen.getByText('Você tem 2 de 3 propostas neste mês.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Apoiar' }))
        await waitFor(() => expect(supportProposal).toHaveBeenCalledWith('token', 'p1'))

        fireEvent.click(screen.getByRole('button', { name: 'Propor esta pauta' }))
        await waitFor(() => expect(proposeAgenda).toHaveBeenCalledWith('token', 'c1', 'capital_budget'))
    })

    it('quem já apoia só vê Retirar meu apoio', async () => {
        vi.mocked(listCompanyProposals).mockResolvedValue(
            base({ proposals: [proposal({ supportedByMe: true, queuePosition: 1, supportCount: 2 })] }),
        )
        vi.mocked(withdrawProposalSupport).mockResolvedValue({ proposal: {} as never, withdrawn: true })
        renderPanel()

        expect(await screen.findByText(/É a próxima a ser escolhida/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Apoiar' })).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Retirar meu apoio' }))
        await waitFor(() => expect(withdrawProposalSupport).toHaveBeenCalledWith('token', 'p1'))
    })

    it('empresa em período de espera avisa os dias e desliga propor e apoiar', async () => {
        vi.mocked(listCompanyProposals).mockResolvedValue(base({ blockedReason: 'company_in_cooldown', cooldownDaysLeft: 12 }))
        renderPanel()

        expect(await screen.findByText(/período de espera por mais 12 dias do mercado/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Apoiar' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Propor esta pauta' })).toBeDisabled()
    })

    it('sem ações da empresa explica o requisito', async () => {
        vi.mocked(listCompanyProposals).mockResolvedValue(base({ holdsShares: false, blockedReason: 'not_shareholder' }))
        renderPanel()
        expect(await screen.findByText(/é preciso ter ações dela/)).toBeInTheDocument()
    })

    it('teto do mês esgotado desliga o botão e diz quando volta', async () => {
        vi.mocked(listCompanyProposals).mockResolvedValue(base({ limits: { monthlyCap: 3, usedThisMonth: 3, minSupport: 2, ttlDays: 30 } }))
        renderPanel()
        expect(await screen.findByText(/Elas voltam no mês que vem/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Propor esta pauta' })).toBeDisabled()
    })

    it('mostra a recusa do servidor em texto', async () => {
        vi.mocked(listCompanyProposals).mockResolvedValue(base())
        vi.mocked(supportProposal).mockRejectedValue(new ApiError(409, 'Esta proposta já foi usada ou expirou.'))
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Apoiar' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Esta proposta já foi usada ou expirou.')
    })
})
