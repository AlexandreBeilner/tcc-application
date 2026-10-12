import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getMyAccount } from '../../services/market'
import type { MyAccount } from '../../services/market'
import { MyAssets } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ getMyAccount: vi.fn() }))

function renderPage(entry = '/ativos') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/ativos', element: <MyAssets /> },
            { path: '/mercado/ativos/:id', element: <div>tela do ativo</div> },
            { path: '/mercado/renda-fixa/:id', element: <div>tela da renda fixa</div> },
            { path: '/mercado', element: <div>tela de mercado</div> },
            { path: '/trilha', element: <div>tela de trilha</div> },
            { path: '/extrato', element: <div>tela de extrato</div> },
        ],
        { initialEntries: [entry] },
    )
    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
    return router
}

const base = { quantity: 10, averagePrice: 30, isSandbox: false }
const account: MyAccount = {
    cashBalance: 5000,
    totalInvested: 0,
    totalDividendsReceived: 15,
    positions: [
        { ...base, assetId: 'p1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', dividendsReceived: 15, markPrice: 33 },
        {
            ...base,
            assetId: 'h1',
            ticker: 'HGLG11',
            name: 'CSHG Logística',
            type: 'fii',
            averagePrice: 100,
            quantity: 2,
            dividendsReceived: 0,
            markPrice: 95,
        },
        { ...base, assetId: 'z0', ticker: 'ZERO3', name: 'Zerada', type: 'acao', quantity: 0, dividendsReceived: 0 },
        { ...base, assetId: 's1', ticker: 'TREINO3', name: 'Ação de treino', type: 'acao', isSandbox: true, dividendsReceived: 0 },
    ],
    fixedIncomePositions: [
        {
            ...base,
            assetId: 'f1',
            ticker: 'CDB2027',
            name: 'CDB Banco',
            type: 'cdb',
            quantity: 1,
            averagePrice: 1000,
            averageRate: 1.1,
            currentValue: 1050,
            netValue: 1040,
        },
        {
            ...base,
            assetId: 'f2',
            ticker: 'LFT2029',
            name: 'Tesouro Selic',
            type: 'tesouro_selic',
            quantity: 1,
            averagePrice: 500,
            averageRate: 1,
        },
    ],
}

function norm(text: string | null | undefined) {
    return (text ?? '').replace(/ /g, ' ')
}

describe('MyAssets', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
        vi.mocked(getMyAccount).mockResolvedValue(account)
    })

    it('lista as posições ao vivo (sem zerada nem sandbox) com valor atual e resultado, mais o resumo', async () => {
        renderPage()
        await waitFor(() => expect(screen.getAllByText('PETR4').length).toBeGreaterThan(0))

        expect(screen.queryByText('ZERO3')).not.toBeInTheDocument()
        expect(screen.queryByText('TREINO3')).not.toBeInTheDocument()
        const summary = screen.getByLabelText('Resumo da carteira')
        // 330 + 190 + 1050 + 500 (renda fixa sem avaliação cai no custo)
        expect(norm(summary.textContent)).toContain('R$ 2.070,00')
        // resultado total: 30 - 10 + 50 + 0 + 15 de proventos = 85 sobre 2.100 de custo
        expect(norm(summary.textContent)).toContain('+R$ 85,00')
    })

    it('renda fixa mostra o líquido de IR; sem avaliação avisa em vez de inventar zero', async () => {
        renderPage()
        await waitFor(() => expect(screen.getAllByText(/Líquido se resgatar hoje/).length).toBeGreaterThan(0))
        expect(norm(screen.getAllByText(/Líquido se resgatar hoje/)[0].textContent)).toContain('R$ 1.040,00')
        expect(screen.getAllByText('Sem avaliação agora').length).toBeGreaterThan(0)
    })

    it('filtro por categoria vem da URL e filtra', async () => {
        renderPage('/ativos?categoria=fiis')
        await waitFor(() => expect(screen.getAllByText('HGLG11').length).toBeGreaterThan(0))
        expect(screen.queryByText('PETR4')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'FIIs', pressed: true })).toBeInTheDocument()
    })

    it('clicar numa categoria troca o filtro; categoria sem ativo mostra aviso', async () => {
        renderPage()
        await waitFor(() => expect(screen.getAllByText('PETR4').length).toBeGreaterThan(0))
        fireEvent.click(screen.getByRole('button', { name: 'ETFs' }))
        expect(await screen.findByText('Nenhum ativo nesta categoria.')).toBeInTheDocument()
    })

    it('aba Modo Aprendizado mostra só o sandbox, com resumo próprio', async () => {
        renderPage()
        await waitFor(() => expect(screen.getAllByText('PETR4').length).toBeGreaterThan(0))
        fireEvent.click(screen.getByRole('tab', { name: 'Modo Aprendizado' }))
        await waitFor(() => expect(screen.getAllByText('TREINO3').length).toBeGreaterThan(0))
        expect(screen.queryByText('PETR4')).not.toBeInTheDocument()
        expect(screen.getByText(/Não contam para o ranking/)).toBeInTheDocument()
    })

    it('a linha leva à página do ativo; renda fixa à própria tela', async () => {
        const router = renderPage('/ativos?categoria=rendaFixa')
        await waitFor(() => expect(screen.getAllByText('CDB2027').length).toBeGreaterThan(0))
        const card = screen.getAllByRole('button').find((el) => el.textContent?.includes('CDB2027'))!
        fireEvent.click(card)
        await waitFor(() => expect(router.state.location.pathname).toBe('/mercado/renda-fixa/f1'))
    })

    it('sem nenhum ativo convida para o Mercado e a Trilha', async () => {
        vi.mocked(getMyAccount).mockResolvedValue({ ...account, positions: [], fixedIncomePositions: [] })
        renderPage()
        expect(await screen.findByText('Você ainda não tem nenhum ativo')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ir pro Mercado' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Ir pra Trilha' })).toBeInTheDocument()
    })

    it('erro mostra mensagem sem quebrar', async () => {
        vi.mocked(getMyAccount).mockRejectedValue(new Error('x'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar seus ativos')
    })

    it('tem link para o extrato completo', async () => {
        renderPage()
        const link = await screen.findByRole('link', { name: 'Ver extrato completo' })
        expect(within(link.parentElement as HTMLElement).getByRole('heading', { name: 'Meus ativos' })).toBeInTheDocument()
    })
})
