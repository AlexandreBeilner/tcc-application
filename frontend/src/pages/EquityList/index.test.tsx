import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAssets } from '../../services/market'
import type { AssetSummary } from '../../services/market'
import { EquityList } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ listAssets: vi.fn() }))

// `AssetTable` sempre renderiza tabela E cards no DOM (só a media query
// decide qual aparece; jsdom não aplica media query) — `getAllByText` em
// vez de `getByText` é o ajuste certo, não um bug do componente.
function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/mercado/renda-variavel', element: <EquityList /> },
            { path: '/mercado/ativos/:id', element: <div>tela de detalhe</div> },
        ],
        { initialEntries: ['/mercado/renda-variavel'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const assets: AssetSummary[] = [
    {
        id: 'a1',
        ticker: 'PETR4',
        name: 'Petrobras',
        type: 'acao',
        risk_class: 'alto',
        is_sandbox: false,
        current_price: 30,
        daily_change_pct: 1.5,
    },
    { id: 'a2', ticker: 'IVVB11', name: 'ETF S&P 500', type: 'etf', is_sandbox: false, current_price: 200 },
]

describe('EquityList (tela 4.4)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra os ativos da aba Ações por padrão, com preço e variação', async () => {
        vi.mocked(listAssets).mockResolvedValue({ assets })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('PETR4').length).toBeGreaterThan(0))
        expect(screen.getAllByText('R$ 30,00').length).toBeGreaterThan(0)
        expect(screen.getAllByText('+1,5%').length).toBeGreaterThan(0)
        expect(screen.queryByText('IVVB11')).not.toBeInTheDocument()
    })

    it('trocar pra aba ETFs filtra pra outra categoria', async () => {
        vi.mocked(listAssets).mockResolvedValue({ assets })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('PETR4').length).toBeGreaterThan(0))
        fireEvent.click(screen.getByText('ETFs'))
        expect(screen.getAllByText('IVVB11').length).toBeGreaterThan(0)
        expect(screen.queryByText('PETR4')).not.toBeInTheDocument()
    })

    it('clique num ativo navega pro detalhe (4.5)', async () => {
        vi.mocked(listAssets).mockResolvedValue({ assets })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('PETR4').length).toBeGreaterThan(0))
        fireEvent.click(screen.getAllByText('PETR4')[0])
        await waitFor(() => expect(screen.getByText('tela de detalhe')).toBeInTheDocument())
    })
})
