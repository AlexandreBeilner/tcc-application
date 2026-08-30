import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAsset, getMyAccount, purchaseFixedIncome, redeemFixedIncome, simulateFixedIncome } from '../../services/market'
import { FixedIncomeDetail } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
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
        expect(screen.getByText('12,0% a.a.')).toBeInTheDocument()
        expect(screen.getByText('banco')).toBeInTheDocument()
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
