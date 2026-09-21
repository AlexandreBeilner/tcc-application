import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { useUnlockedKeys } from '../../features/lessons/useUnlockedKeys'
import { getAsset, getMyAccount, purchaseFixedIncome, redeemFixedIncome, simulateFixedIncome } from '../../services/market'
import { FixedIncomeDetail } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../features/lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))
vi.mock('../../services/market', () => ({
    getAsset: vi.fn(),
    getMyAccount: vi.fn(),
    simulateFixedIncome: vi.fn(),
    placeOrder: vi.fn(),
    purchaseFixedIncome: vi.fn(),
    redeemFixedIncome: vi.fn(),
}))

const emptyAccount = { cashBalance: 10000, totalInvested: 0, totalDividendsReceived: 0, positions: [], fixedIncomePositions: [] }

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/mercado/renda-fixa/:id', element: <FixedIncomeDetail /> }], {
        initialEntries: ['/mercado/renda-fixa/a1'],
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('FixedIncomeDetail (tela 4.3)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        // CDB já desbloqueado por padrão — os testes deste arquivo não são
        // sobre o gate da Fase Q, ver describe dedicado abaixo pro estado
        // travado.
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(['asset:cdb']), lessons: [], isLoading: false, isError: false })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra taxa, vencimento e emissor do produto', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'CDB2027',
                name: 'CDB Banco X',
                type: 'cdb',
                is_sandbox: false,
                fixed_income: {
                    interest_rate: 12,
                    maturity_date: '2027-01-01T00:00:00Z',
                    issuer_type: 'banco',
                    tax_exempt: false,
                    minimum_investment: 100,
                },
            },
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('CDB2027')).toBeInTheDocument())
        // CDB é pós-fixado (tarefa L.1, backlog-motor-mercado-realista) —
        // `interest_rate` significa "% do CDI", não "% a.a.".
        expect(screen.getByText('12,0% do CDI')).toBeInTheDocument()
        expect(screen.getByText('banco')).toBeInTheDocument()
    })

    it('mostra a taxa como "a.a." pra um produto prefixado (Tesouro Prefixado)', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'LTN2027',
                name: 'Tesouro Prefixado 2027',
                type: 'tesouro_prefixado',
                is_sandbox: false,
                fixed_income: {
                    interest_rate: 11.75,
                    maturity_date: '2027-01-01T00:00:00Z',
                    issuer_type: 'tesouro',
                    tax_exempt: false,
                    minimum_investment: 30,
                },
            },
        })
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(['asset:tesouro_prefixado']),
            lessons: [],
            isLoading: false,
            isError: false,
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('LTN2027')).toBeInTheDocument())
        expect(screen.getByText('11,8% a.a.')).toBeInTheDocument()
    })

    it('digitar um valor dispara a simulação e "Investir" abre a confirmação como overlay, sem navegar', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'CDB2027',
                name: 'CDB Banco X',
                type: 'cdb',
                is_sandbox: false,
                fixed_income: { issuer_type: 'banco', tax_exempt: false, minimum_investment: 100 },
            },
        })
        vi.mocked(simulateFixedIncome).mockResolvedValue({
            unit_price: 1,
            quantity_purchased: 1000,
            gross_projected_value: 1100,
            tax_rate: 0.2,
            net_projected_value: 1080,
        })

        renderPage()
        await waitFor(() => expect(screen.getByText('CDB2027')).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText('Valor do aporte'), { target: { value: '1000' } })
        await waitFor(() => expect(screen.getByText('R$ 1.080,00')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Investir' }))
        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        // A tela de origem continua montada atrás do overlay (não é navegação).
        expect(screen.getByText('CDB2027')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar aporte' }))
        await waitFor(() => expect(purchaseFixedIncome).toHaveBeenCalledWith('token', { asset_id: 'a1', amount: 1000 }))
    })

    it('com posição existente, mostra a quantidade e o botão Resgatar', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'CDB2027',
                name: 'CDB Banco X',
                type: 'cdb',
                is_sandbox: false,
                fixed_income: { issuer_type: 'banco', tax_exempt: false, minimum_investment: 100 },
            },
        })
        vi.mocked(getMyAccount).mockResolvedValue({
            ...emptyAccount,
            fixedIncomePositions: [
                {
                    assetId: 'a1',
                    ticker: 'CDB2027',
                    name: 'CDB Banco X',
                    type: 'cdb',
                    isSandbox: false,
                    quantity: 500,
                    averagePrice: 1,
                    averageRate: 0.1,
                },
            ],
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Sua posição: 500.00 unidades')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Resgatar' }))
        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar resgate' }))
        await waitFor(() => expect(redeemFixedIncome).toHaveBeenCalledWith('token', { asset_id: 'a1' }))
    })
})

// Fase Q — antes desta tarefa, esta tela não checava nenhum gate: clicar
// num produto travado na grid de `FixedIncomeList` chegava aqui com o
// simulador/CTA de investir 100% funcionais (bug real, achado do autor).
describe('FixedIncomeDetail — produto travado pela trilha (Fase Q)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'CDB2027',
                name: 'CDB Banco X',
                type: 'cdb',
                is_sandbox: false,
                fixed_income: {
                    interest_rate: 12,
                    maturity_date: '2027-01-01T00:00:00Z',
                    issuer_type: 'banco',
                    tax_exempt: false,
                    minimum_investment: 100,
                },
            },
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra só o card de bloqueio — nada de taxa/vencimento/simulador', async () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [
                {
                    id: 'lesson-1-3',
                    code: '1.3',
                    title: 'Compra real de CDB',
                    trackNumber: 1,
                    trackName: 'Renda Fixa',
                    sortOrder: 5,
                    centralConcept: 'x',
                    scenarioText: '',
                    microDecisionPrompt: '',
                    microDecisionType: 'reflection',
                    microDecisionAssetTicker: null,
                    revelationText: '',
                    unlocksDescription: '',
                    unlocksKeys: ['asset:cdb'],
                    unlocksAssetTicker: null,
                    microDecisionOptions: null,
                    status: 'available',
                    currentStep: 0,
                },
            ],
            isLoading: false,
            isError: false,
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Travado pela trilha')).toBeInTheDocument())
        expect(screen.getByText('Complete a lição "Compra real de CDB" na trilha pra liberar isso.')).toBeInTheDocument()
        expect(screen.queryByText('CDB2027')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Valor do aporte')).not.toBeInTheDocument()
        expect(screen.queryByText(/Lição \d/)).not.toBeInTheDocument()
    })
})
