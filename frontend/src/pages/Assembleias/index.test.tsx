import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAssemblies } from '../../services/assemblies'
import type { AssemblySummary } from '../../services/assemblies'
import { getBillingStatus } from '../../services/billing'
import { ApiError } from '../../services/client'
import { Assembleias } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/assemblies', () => ({ listAssemblies: vi.fn() }))
vi.mock('../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))

const FREE = {
    isPro: false,
    state: 'none',
    plan: null,
    store: null,
    expiresAt: null,
    willRenew: false,
    managementUrl: null,
    billingEnabled: true,
} as const

const summary = (over: Partial<AssemblySummary>): AssemblySummary => ({
    id: 'a1',
    kind: 'shareholder',
    subjectRef: 'c1',
    subjectLabel: 'Acme',
    title: 'Destinação do lucro',
    status: 'open',
    opensAt: '2026-10-01T00:00:00Z',
    closesAt: '2099-10-08T00:00:00Z',
    effectAppliesAt: '2099-10-09T00:00:00Z',
    effectAppliedAt: null,
    outcome: null,
    outcomeReason: null,
    voterCount: null,
    dividendOnHold: false,
    ...over,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Assembleias />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Assembleias (MO.6.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        vi.mocked(getBillingStatus).mockResolvedValue(FREE)
    })
    afterEach(() => vi.clearAllMocks())

    it('lista abertas e encerradas com o estado em texto e link para a assembleia', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({
            open: [summary({})],
            closed: [
                summary({
                    id: 'a2',
                    status: 'closed',
                    title: 'Endividamento',
                    outcome: 'approved',
                    outcomeReason: 'decided',
                    voterCount: 4,
                }),
            ],
        })
        renderPage()

        expect(await screen.findByText('Destinação do lucro')).toBeInTheDocument()
        expect(screen.getByText('Votação aberta')).toBeInTheDocument()
        expect(screen.getByText('Aprovada')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Destinação do lucro/ })).toHaveAttribute('href', '/assembleias/a1')
        expect(screen.getByRole('heading', { name: 'Encerradas' })).toBeInTheDocument()
        expect(screen.getByText(/Com poucos votantes ou empate, nada muda/)).toBeInTheDocument()
    })

    it('bloco do PRO: convite a quem não é PRO e confirmação a quem é', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [], closed: [] })
        renderPage()
        expect(await screen.findByRole('heading', { name: 'Como o PRO participa' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Ver o que o PRO inclui' })).toHaveAttribute('href', '/planos')
    })

    it('bloco do PRO para assinante diz que vota em todas', async () => {
        vi.mocked(getBillingStatus).mockResolvedValue({ ...FREE, isPro: true, state: 'active' })
        vi.mocked(listAssemblies).mockResolvedValue({ open: [], closed: [] })
        renderPage()
        expect(await screen.findByText('Você vota em todas as assembleias das empresas que possui.')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Ver o que o PRO inclui' })).toBeNull()
    })

    it('sem votação aberta explica quando abre a próxima, sem pressão', async () => {
        vi.mocked(listAssemblies).mockResolvedValue({ open: [], closed: [] })
        renderPage()
        expect(await screen.findByText(/Nenhuma votação aberta/)).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Encerradas' })).toBeNull()
    })

    it('desligamento de emergência (404): tela "indisponíveis no momento" com a saída para o Mercado', async () => {
        vi.mocked(listAssemblies).mockRejectedValue(new ApiError(404, 'não encontrado'))
        renderPage()
        expect(await screen.findByRole('heading', { name: 'Assembleias indisponíveis no momento' })).toBeInTheDocument()
        expect(screen.getByText(/Seu progresso e suas ações continuam como estão/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Voltar ao Mercado' })).toHaveAttribute('href', '/mercado')
    })
})
