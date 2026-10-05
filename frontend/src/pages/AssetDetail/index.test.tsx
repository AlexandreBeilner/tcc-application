import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { useUnlockedKeys } from '../../features/lessons/useUnlockedKeys'
import { getAsset, getAssetBook, getAssetQuotes, getMyAccount, getTradingHalts } from '../../services/market'
import { AssetDetail } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../features/lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))
vi.mock('../../services/market', () => ({
    getAsset: vi.fn(),
    getAssetBook: vi.fn(),
    getAssetQuotes: vi.fn(),
    getMyAccount: vi.fn(),
    getTradingHalts: vi.fn(),
    placeOrder: vi.fn(),
    purchaseFixedIncome: vi.fn(),
    redeemFixedIncome: vi.fn(),
}))

const emptyBook = { book: { is_sandbox: false, price: null, best_bid: null, best_ask: null, mid_price: null, bids: null, asks: null } }

const emptyAccount = { cashBalance: 10000, totalInvested: 0, totalDividendsReceived: 0, positions: [], fixedIncomePositions: [] }

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/mercado/ativos/:id', element: <AssetDetail /> },
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
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getAssetBook).mockResolvedValue(emptyBook)
        vi.mocked(getTradingHalts).mockResolvedValue({ global: false, asset_ids: [] })
        // Ação/ETF/FII já desbloqueados por padrão — os testes deste arquivo
        // não são sobre o gate da tarefa 7.0.1, ver describe dedicado da J.3
        // abaixo pro estado travado.
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(['asset:acao', 'asset:etf']),
            lessons: [],
            isLoading: false,
            isError: false,
        })
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
        // Tarefa S.16: sem posição nenhuma nesse ativo (emptyAccount), o card
        // "Sua posição" não aparece.
        expect(screen.queryByText('Sua posição')).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('Ver empresa: Petrobras S.A.'))
        await waitFor(() => expect(screen.getByText('tela de empresa')).toBeInTheDocument())
    })

    it('com posição real e provento recebido (tarefa S.16), o card "Sua posição" mostra retorno total maior que o de preço', async () => {
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
        vi.mocked(getMyAccount).mockResolvedValue({
            ...emptyAccount,
            positions: [
                {
                    assetId: 'a1',
                    ticker: 'PETR4',
                    name: 'Petrobras',
                    type: 'acao',
                    isSandbox: false,
                    quantity: 10,
                    averagePrice: 100,
                    markPrice: 110,
                    dividendsReceived: 50,
                },
            ],
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Sua posição')).toBeInTheDocument())
        // (110-100)/100 = +10,0%; ((110-100)*10 + 50)/(100*10) = +15,0%.
        expect(screen.getByText('+10,0%')).toBeInTheDocument()
        expect(screen.getByText('+15,0%')).toBeInTheDocument()
    })

    it('com posição real sem provento nenhum (tarefa S.16), os dois retornos do card são iguais', async () => {
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
        vi.mocked(getMyAccount).mockResolvedValue({
            ...emptyAccount,
            positions: [
                {
                    assetId: 'a1',
                    ticker: 'PETR4',
                    name: 'Petrobras',
                    type: 'acao',
                    isSandbox: false,
                    quantity: 10,
                    averagePrice: 100,
                    markPrice: 110,
                    dividendsReceived: 0,
                },
            ],
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('Sua posição')).toBeInTheDocument())
        expect(screen.getAllByText('+10,0%')).toHaveLength(2)
    })

    it('posição zerada por venda total (tarefa S.16, achado revisado): o motor nunca deleta a linha, mas o card não aparece', async () => {
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
        vi.mocked(getMyAccount).mockResolvedValue({
            ...emptyAccount,
            positions: [
                {
                    assetId: 'a1',
                    ticker: 'PETR4',
                    name: 'Petrobras',
                    type: 'acao',
                    isSandbox: false,
                    quantity: 0,
                    averagePrice: 100,
                    dividendsReceived: 20,
                },
            ],
        })

        renderPage()

        await waitFor(() => expect(screen.getByText('PETR4')).toBeInTheDocument())
        expect(screen.queryByText('Sua posição')).not.toBeInTheDocument()
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
                etf: { benchmark_index: 'S&P 500', holdings: [], dividend_history: [] },
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

    it.each([
        ['pausa do ativo', { global: false, asset_ids: ['a1'] }, 'neste ativo'],
        ['pausa global', { global: true, asset_ids: [] }, 'todo o mercado'],
    ])('%s (tarefa N.9): avisa em texto e desabilita a ordem', async (_name, halts, expected) => {
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
        vi.mocked(getTradingHalts).mockResolvedValue(halts)

        renderPage()

        expect(await screen.findByText(new RegExp(`Negociação pausada .*${expected}`))).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Revisar ordem' })).toBeDisabled()
    })

    it('ativo sandbox nunca é pausado (N.9): a ordem segue habilitada', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'SBX3',
                name: 'Sandbox',
                type: 'acao',
                is_sandbox: true,
                current_price: 30,
                equity: { company: { id: 'c1', name: 'Sandbox S.A.', cnpj: '00', sector: 'Energia' }, dividend_history: [] },
            },
        })
        vi.mocked(getTradingHalts).mockResolvedValue({ global: true, asset_ids: [] })

        renderPage()
        await waitFor(() => expect(screen.getByText('SBX3')).toBeInTheDocument())

        expect(screen.queryByText(/Negociação pausada/)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Revisar ordem' })).toBeEnabled()
    })

    it('"Revisar ordem" abre a confirmação como overlay sobre a própria tela, sem navegar', async () => {
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
        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        // A tela de origem continua montada atrás do overlay (não é navegação).
        expect(screen.getByText('PETR4')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        await waitFor(() => expect(screen.queryByText('Confirmar ordem')).not.toBeInTheDocument())
    })
})

// Fase Q (reversão da J.3 "prévia, não parede") — o Detalhe é sempre
// alcançável (EquityList não redireciona mais pra lição, `useLockedAssetGate`),
// mas quando o ativo ainda está travado a tela inteira vira parede: só o
// card `LockedAssetPanel`, nada de ticker/preço/gráfico/indicadores.
describe('AssetDetail — ativo travado pela trilha (Fase Q)', () => {
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
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getAssetBook).mockResolvedValue(emptyBook)
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'PETR4',
                name: 'Petrobras',
                type: 'acao',
                is_sandbox: false,
                current_price: 30,
                equity: {
                    company: { id: 'c1', name: 'Petrobras S.A.', cnpj: '00', sector: 'Energia' },
                    indicators: { price_to_earnings: 14.2 },
                    dividend_history: [],
                },
            },
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra só o card de bloqueio — nada de ticker/preço/indicadores/painel de compra', async () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [
                {
                    id: 'lesson-2-3',
                    code: '2.3',
                    title: 'Nomenclatura de tickers',
                    trackNumber: 2,
                    trackName: 'Renda Variável',
                    sortOrder: 10,
                    centralConcept: 'x',
                    scenarioText: '',
                    microDecisionPrompt: '',
                    microDecisionType: 'reflection',
                    microDecisionAssetTicker: null,
                    revelationText: '',
                    unlocksDescription: '',
                    unlocksKeys: ['asset:acao'],
                    unlocksAssetTicker: null,
                    microDecisionOptions: null,
                    status: 'available',
                    currentStep: 0,
                },
            ],
            isLoading: false,
            isError: false,
        })

        const router = createMemoryRouter(
            [
                { path: '/mercado/ativos/:id', element: <AssetDetail /> },
                { path: '/trilha/:id', element: <div>tela de lição</div> },
            ],
            { initialEntries: ['/mercado/ativos/a1'] },
        )
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        )

        await waitFor(() => expect(screen.getByText('Travado pela trilha')).toBeInTheDocument())
        expect(screen.getByText('Complete a lição "Nomenclatura de tickers" na trilha pra liberar isso.')).toBeInTheDocument()
        expect(screen.queryByText(/Lição \d/)).not.toBeInTheDocument()

        expect(screen.queryByText('PETR4')).not.toBeInTheDocument()
        expect(screen.queryByText('P/L')).not.toBeInTheDocument()
        expect(screen.queryByText('R$ 30,00')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Revisar ordem' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('Ir pra lição'))
        await waitFor(() => expect(screen.getByText('tela de lição')).toBeInTheDocument())
    })

    it('CTA navega pro Mapa da Trilha (nunca pra lição) quando a chave desbloqueia numa lição ainda locked pro usuário (tarefa N.2)', async () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [
                {
                    id: 'lesson-2-3',
                    code: '2.3',
                    title: 'Nomenclatura de tickers',
                    trackNumber: 2,
                    trackName: 'Renda Variável',
                    sortOrder: 18,
                    centralConcept: 'x',
                    scenarioText: '',
                    microDecisionPrompt: '',
                    microDecisionType: 'reflection',
                    microDecisionAssetTicker: null,
                    revelationText: '',
                    unlocksDescription: '',
                    unlocksKeys: ['asset:acao'],
                    unlocksAssetTicker: null,
                    microDecisionOptions: null,
                    status: 'locked',
                    currentStep: 0,
                },
            ],
            isLoading: false,
            isError: false,
        })

        const router = createMemoryRouter(
            [
                { path: '/mercado/ativos/:id', element: <AssetDetail /> },
                { path: '/trilha/:id', element: <div>tela de lição</div> },
                { path: '/trilha', element: <div>mapa da trilha</div> },
            ],
            { initialEntries: ['/mercado/ativos/a1'] },
        )
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        )

        await waitFor(() => expect(screen.getByText('Travado pela trilha')).toBeInTheDocument())
        expect(screen.getByText('Complete a lição "Nomenclatura de tickers" na trilha pra liberar isso.')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Ir pra lição'))
        await waitFor(() => expect(screen.getByText('mapa da trilha')).toBeInTheDocument())
        expect(screen.queryByText('tela de lição')).not.toBeInTheDocument()
    })

    it('sandbox continua com o painel de compra normal, mesmo sem nenhuma lição concluída (RF12)', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: {
                id: 'a1',
                ticker: 'PETR4',
                name: 'Petrobras',
                type: 'acao',
                is_sandbox: true,
                current_price: 30,
                equity: { company: { id: 'c1', name: 'Petrobras S.A.', cnpj: '00', sector: 'Energia' }, dividend_history: [] },
            },
        })
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: false })

        renderPage()

        await waitFor(() => expect(screen.getByText('PETR4')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Revisar ordem' })).toBeInTheDocument()
        expect(screen.queryByText('Travado pela trilha')).not.toBeInTheDocument()
    })
})
