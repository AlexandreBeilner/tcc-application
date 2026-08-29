import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAsset, getAssetQuotes } from '../../services/market'
import { AssetDetail } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ getAsset: vi.fn(), getAssetQuotes: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/mercado/ativos/:id', element: <AssetDetail /> },
            { path: '/mercado/confirmar', element: <div>tela de confirmação</div> },
            { path: '/mercado/empresas/:id', element: <div>tela de empresa</div> },
        ],
        { initialEntries: ['/mercado/ativos/a1'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('AssetDetail (tela 4.5)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getAssetQuotes).mockResolvedValue({ quotes: [] })
    })

    afterEach(() => vi.clearAllMocks())

    it('ação: mostra indicadores, link pra empresa e histórico de proventos', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'PETR4',
                name: 'Petrobras',
                type: 'acao',
                is_sandbox: false,
                current_price: 30,
                daily_change_pct: 1.5,
                equity: {
                    company: { id: 'c1', name: 'Petrobras S.A.', cnpj: '00', sector: 'Energia' },
                    indicators: { price_to_earnings: 14.2 },
                    dividend_history: [],
                },
            },
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('PETR4')).toBeInTheDocument())
        expect(screen.getByText('P/L')).toBeInTheDocument()
        expect(screen.getByText('Este ativo ainda não pagou nenhum provento.')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Ver empresa: Petrobras S.A.'))
        await waitFor(() => expect(screen.getByText('tela de empresa')).toBeInTheDocument())
    })

    it('etf: mostra composição, sem indicadores de empresa', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a2',
                ticker: 'IVVB11',
                name: 'ETF S&P 500',
                type: 'etf',
                is_sandbox: false,
                current_price: 200,
                etf: { benchmark_index: 'S&P 500', holdings: [] },
            },
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('IVVB11')).toBeInTheDocument())
        expect(screen.getByText('S&P 500')).toBeInTheDocument()
        expect(screen.queryByText('P/L')).not.toBeInTheDocument()
    })

    it('sem cotação ainda, mostra "aguardando primeira cotação" em vez de erro', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a3',
                ticker: 'NOVO4',
                name: 'Novo Ativo',
                type: 'acao',
                is_sandbox: false,
                equity: { company: { id: 'c2', name: 'Novo', cnpj: '00', sector: 'X' }, dividend_history: [] },
            },
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Aguardando primeira cotação')).toBeInTheDocument())
    })

    it('"Revisar ordem" navega pra confirmação com o rascunho de compra', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'PETR4',
                name: 'Petrobras',
                type: 'acao',
                is_sandbox: false,
                current_price: 30,
                equity: { company: { id: 'c1', name: 'Petrobras S.A.', cnpj: '00', sector: 'Energia' }, dividend_history: [] },
            },
        })

        renderPage()
        await waitFor(() => expect(screen.getByText('PETR4')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Revisar ordem' }))
        await waitFor(() => expect(screen.getByText('tela de confirmação')).toBeInTheDocument())
    })
})
