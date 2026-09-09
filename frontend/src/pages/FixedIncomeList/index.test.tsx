import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { useUnlockedKeys } from '../../features/lessons/useUnlockedKeys'
import { listAssets } from '../../services/market'
import type { AssetSummary } from '../../services/market'
import { FixedIncomeList } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../features/lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))
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
        // Tesouro Selic e CDB já desbloqueados por padrão — os testes deste
        // arquivo não são sobre o gate da tarefa 7.0.1 (ver describe dedicado
        // abaixo).
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(['asset:tesouro_selic', 'asset:cdb']),
            lessons: [],
            isLoading: false,
            isError: false,
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

    it('pagina a aba atual e reseta a página ao trocar de aba (6.9.8)', async () => {
        const manyTesouro: AssetSummary[] = Array.from({ length: 25 }, (_, i) => ({
            id: `t${i}`,
            ticker: `TES${i}`,
            name: `Tesouro ${i}`,
            type: 'tesouro_selic',
            is_sandbox: false,
        }))
        vi.mocked(listAssets).mockResolvedValue({ assets: [...manyTesouro, ...assets] })
        renderPage()

        await waitFor(() => expect(screen.getByRole('navigation', { name: 'Paginação de Renda Fixa' })).toBeInTheDocument())
        expect(screen.getAllByText('Tesouro 0').length).toBeGreaterThan(0)
        expect(screen.queryByText('Tesouro 20')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
        expect(screen.getAllByText('Tesouro 20').length).toBeGreaterThan(0)
        expect(screen.queryByText('Tesouro 0')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('CDBs, LCA e LCI'))
        expect(screen.queryByRole('navigation', { name: 'Paginação de Renda Fixa' })).not.toBeInTheDocument()
        expect(screen.getAllByText('CDB Banco X').length).toBeGreaterThan(0)
    })
})

describe('FixedIncomeList — estado travado pela trilha (tarefa 7.0.1)', () => {
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

    it('produto real ainda travado mostra o cadeado, mas clicar abre o Detalhe normalmente (tarefa J.3)', async () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [
                {
                    id: 'lesson-1-2',
                    code: '1.2',
                    title: 'Tesouro Selic',
                    trackNumber: 1,
                    trackName: 'Renda Fixa',
                    sortOrder: 7,
                    centralConcept: 'x',
                    scenarioText: '',
                    microDecisionPrompt: '',
                    microDecisionType: 'reflection',
                    microDecisionAssetTicker: null,
                    revelationText: '',
                    unlocksDescription: '',
                    unlocksKeys: ['asset:tesouro_selic'],
                    unlocksAssetTicker: null,
                    microDecisionOptions: null,
                    status: 'available',
                    currentStep: 0,
                },
            ],
            isLoading: false,
            isError: false,
        })
        vi.mocked(listAssets).mockResolvedValue({ assets })
        renderPage()

        await waitFor(() => expect(screen.getAllByText('Tesouro Selic').length).toBeGreaterThan(0))
        expect(screen.getAllByLabelText('Produto travado, desbloqueia na lição 1.2').length).toBeGreaterThan(0)

        fireEvent.click(screen.getAllByText('Tesouro Selic')[0])
        await waitFor(() => expect(screen.getByText('tela de detalhe')).toBeInTheDocument())
    })

    it('sandbox continua acessível mesmo sem nenhuma lição concluída (RF12)', async () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: false })
        const sandboxAsset: AssetSummary = { id: 'sand-1', ticker: 'SANDPRE', name: 'Sandbox', type: 'tesouro_selic', is_sandbox: true }
        vi.mocked(listAssets).mockResolvedValue({ assets: [sandboxAsset] })
        renderPage()

        await waitFor(() => expect(screen.getAllByText('SANDPRE').length).toBeGreaterThan(0))
        expect(screen.queryByLabelText(/Produto travado/)).not.toBeInTheDocument()
    })
})
