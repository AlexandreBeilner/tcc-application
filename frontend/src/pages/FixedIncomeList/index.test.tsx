import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAssets } from '../../services/market'
import type { AssetSummary } from '../../services/market'
import { FixedIncomeList } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ listAssets: vi.fn() }))

// `AssetTable` (organism reaproveitado) sempre renderiza tabela E lista de
// cards no DOM — só a media query (CSS) decide qual aparece; jsdom não
// aplica media query nenhuma, então todo texto de coluna existe 2x aqui.
// `getAllByText(...)[0]` em vez de `getByText` é o ajuste certo pro teste,
// não um bug do componente.
function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/mercado/renda-fixa', element: <FixedIncomeList /> },
            { path: '/mercado/renda-fixa/:id', element: <div>tela de detalhe</div> },
        ],
        { initialEntries: ['/mercado/renda-fixa'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const assets: AssetSummary[] = [
    { id: 'a1', ticker: 'TSELIC', name: 'Tesouro Selic', type: 'tesouro_selic', is_sandbox: false },
    { id: 'a2', ticker: 'CDB01', name: 'CDB Banco X', type: 'cdb', risk_class: 'baixo', is_sandbox: false },
]

describe('FixedIncomeList (tela 4.2)', () => {
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

    it('mostra os produtos da aba Tesouro por padrão', async () => {
        vi.mocked(listAssets).mockResolvedValue({ assets })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('Tesouro Selic').length).toBeGreaterThan(0))
        expect(screen.queryByText('CDB Banco X')).not.toBeInTheDocument()
    })

    it('trocar de aba filtra pra outra categoria', async () => {
        vi.mocked(listAssets).mockResolvedValue({ assets })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('Tesouro Selic').length).toBeGreaterThan(0))

        fireEvent.click(screen.getByText('CDBs, LCA e LCI'))
        expect(screen.getAllByText('CDB Banco X').length).toBeGreaterThan(0)
        expect(screen.queryByText('Tesouro Selic')).not.toBeInTheDocument()
    })

    it('clique num produto navega pro detalhe (4.3)', async () => {
        vi.mocked(listAssets).mockResolvedValue({ assets })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('Tesouro Selic').length).toBeGreaterThan(0))
        fireEvent.click(screen.getAllByText('Tesouro Selic')[0])
        await waitFor(() => expect(screen.getByText('tela de detalhe')).toBeInTheDocument())
    })
})
