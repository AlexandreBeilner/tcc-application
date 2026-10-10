import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { ApiError } from '../../../services/client'
import { getAsset, getAssetBook, getMyAccount, placeOrder, purchaseFixedIncome, redeemFixedIncome } from '../../../services/market'
import type { OrderDraft } from './types'
import { OrderConfirmationDialog } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({
    getAsset: vi.fn(),
    getAssetBook: vi.fn(),
    getMyAccount: vi.fn(),
    placeOrder: vi.fn(),
    purchaseFixedIncome: vi.fn(),
    redeemFixedIncome: vi.fn(),
}))

const emptyBook = { book: { is_sandbox: false, price: null, best_bid: null, best_ask: null, mid_price: null, bids: null, asks: null } }

function renderDialog(draft: OrderDraft, onClose = vi.fn()) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/mercado/ativos/:id', element: <OrderConfirmationDialog draft={draft} onClose={onClose} /> },
            { path: '/', element: <div>tela de portfólio</div> },
        ],
        { initialEntries: ['/mercado/ativos/a1'] },
    )
    return {
        ...render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        ),
        onClose,
    }
}

const account = { cashBalance: 10000, totalInvested: 0, totalDividendsReceived: 0, positions: [], fixedIncomePositions: [] }

describe('OrderConfirmationDialog (tela 4.7)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getMyAccount).mockResolvedValue(account)
        vi.mocked(getAssetBook).mockResolvedValue(emptyBook)
    })

    afterEach(() => vi.clearAllMocks())

    it('ordem de compra: mostra o resumo e confirma via POST /market/orders', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockResolvedValue({ order_id: 'o1', filled_quantity: 10, remaining_quantity: 0, fills: [] })

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'buy', quantity: 10, unitPrice: 30 })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        expect(screen.getByText('R$ 300,00')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        await waitFor(() => expect(placeOrder).toHaveBeenCalledWith('token', { asset_id: 'a1', side: 'buy', type: 'market', quantity: 10 }))
        await waitFor(() => expect(screen.getByText('Ordem executada')).toBeInTheDocument())
        expect(screen.getByText('Você comprou 10 PETR4.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Voltar pro Portfólio' }))
        await waitFor(() => expect(screen.getByText('tela de portfólio')).toBeInTheDocument())
    })

    // Tarefa A.2 (backlog-motor-mercado-realista): ordem a mercado do
    // Mercado Ao Vivo sem liquidez real suficiente executa só uma parte —
    // sem preenchimento sintético, `remaining_quantity` reporta a sobra.
    it('ordem de compra com execução parcial (sem liquidez suficiente): mensagem clara, sem quebrar a confirmação', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockResolvedValue({ order_id: 'o1', filled_quantity: 4, remaining_quantity: 6, fills: [] })

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'buy', quantity: 10, unitPrice: 30 })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        await waitFor(() => expect(screen.getByText('Ordem executada')).toBeInTheDocument())
        expect(
            screen.getByText('Você comprou 4 de 10 PETR4. O restante não achou liquidez suficiente e não foi executado.'),
        ).toBeInTheDocument()
    })

    it('ordem de compra sem nenhuma liquidez disponível: mensagem clara de nada executado', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockResolvedValue({ order_id: 'o1', filled_quantity: 0, remaining_quantity: 10, fills: [] })

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'buy', quantity: 10, unitPrice: 30 })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        await waitFor(() => expect(screen.getByText('Ordem executada')).toBeInTheDocument())
        expect(
            screen.getByText(
                'Não havia liquidez suficiente pra negociar PETR4 agora. Nenhuma unidade foi comprada. Tente novamente mais tarde.',
            ),
        ).toBeInTheDocument()
    })

    // Tarefa S.7 (achado 021): resultado informa o preço médio realmente
    // executado (fills contra o book), não o preço unitário estático de
    // antes da confirmação.
    it('ordem de compra executada: resultado informa o preço médio executado', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockResolvedValue({
            order_id: 'o1',
            filled_quantity: 10,
            remaining_quantity: 0,
            fills: [
                { price: 31, quantity: 6, synthetic: false },
                { price: 32, quantity: 4, synthetic: false },
            ],
        })

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'buy', quantity: 10, unitPrice: 30 })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        await waitFor(() => expect(screen.getByText('Ordem executada')).toBeInTheDocument())
        expect(screen.getByText('Você comprou 10 PETR4 a preço médio de R$ 31,40.')).toBeInTheDocument()
    })

    it('aporte de renda fixa: confirma via POST /market/fixed-income/purchases', async () => {
        vi.mocked(getAsset).mockResolvedValue({ asset: { id: 'a2', ticker: 'CDB01', name: 'CDB Banco X', type: 'cdb', is_sandbox: false } })
        vi.mocked(purchaseFixedIncome).mockResolvedValue({
            unit_price: 1,
            quantity_purchased: 1000,
            position: { quantity: 1000, average_price: 1, average_rate: 0.1 },
        })

        renderDialog({ kind: 'fixed_income_purchase', assetId: 'a2', ticker: 'CDB01', name: 'CDB Banco X', amount: 1000 })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar aporte' }))

        await waitFor(() => expect(purchaseFixedIncome).toHaveBeenCalledWith('token', { asset_id: 'a2', amount: 1000 }))
        await waitFor(() => expect(screen.getByText('Você investiu R$ 1.000,00 em CDB01.')).toBeInTheDocument())
    })

    it('resgate de renda fixa: confirma via POST /market/fixed-income/redemptions', async () => {
        vi.mocked(getAsset).mockResolvedValue({ asset: { id: 'a2', ticker: 'CDB01', name: 'CDB Banco X', type: 'cdb', is_sandbox: false } })
        vi.mocked(redeemFixedIncome).mockResolvedValue({
            total_value: 1100,
            net_value: 1080,
            tax_rate: 0.2,
            mark_to_market: { mark_to_market_price: 1.1, realized_return_pct: 0.1, vs_contracted_rate: 0.01 },
        })

        renderDialog({ kind: 'fixed_income_redemption', assetId: 'a2', ticker: 'CDB01', name: 'CDB Banco X' })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar resgate' }))

        await waitFor(() => expect(redeemFixedIncome).toHaveBeenCalledWith('token', { asset_id: 'a2' }))
        await waitFor(() => expect(screen.getByText('Você resgatou CDB01: R$ 1.080,00 líquidos (bruto R$ 1.100,00).')).toBeInTheDocument())
    })

    it('erro do backend aparece inline, sem quebrar a tela', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockRejectedValue(new Error('falha de rede'))

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'buy', quantity: 10, unitPrice: 30 })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        await waitFor(() => expect(screen.getByText('Não foi possível concluir a operação agora.')).toBeInTheDocument())
    })

    // Achado 021 (`pontos-em-aberto-decisao-produto.md`)/tarefa S.7: "all-in
    // por último preço deixa de cair em 422 genérico" — a mensagem passa a
    // informar a quantidade máxima calculada pela profundidade real do book.
    it('422 de saldo insuficiente: mensagem clara com a quantidade máxima pela profundidade do book', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(getAssetBook).mockResolvedValue({
            book: {
                is_sandbox: false,
                price: null,
                best_bid: null,
                best_ask: 31,
                mid_price: null,
                bids: null,
                asks: [
                    { price: 31, quantity: 5 },
                    { price: 32, quantity: 50 },
                ],
            },
        })
        vi.mocked(placeOrder).mockRejectedValue(
            new ApiError(422, 'Saldo insuficiente para essa operação.', { code: 'insufficient_balance' }),
        )

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'buy', quantity: 1000, unitPrice: 30 })

        // Espera o saldo em caixa (accountQuery) carregar antes de confirmar —
        // `cashBalance`/`ownedQuantity` são lidos no closure de `handleConfirm`
        // no momento do clique, não só quando o 422 chega.
        await waitFor(() => expect(screen.getByText(/Saldo em caixa/)).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        // Profundidade visível limita antes do saldo (account.cashBalance = 10000): 5 no melhor ask (31) + 50 no seguinte (32) = 55.
        await waitFor(() =>
            expect(
                screen.getByText(
                    'Saldo insuficiente para essa quantidade. Com o saldo e o book atuais, dá pra comprar no máximo 55 PETR4.',
                ),
            ).toBeInTheDocument(),
        )
    })

    it('422 de posição insuficiente: mensagem clara com a quantidade realmente disponível', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(getMyAccount).mockResolvedValue({
            ...account,
            positions: [
                {
                    assetId: 'a1',
                    ticker: 'PETR4',
                    name: 'Petrobras',
                    type: 'acao',
                    isSandbox: false,
                    quantity: 4,
                    averagePrice: 28,
                    dividendsReceived: 0,
                },
            ],
        })
        vi.mocked(placeOrder).mockRejectedValue(
            new ApiError(422, 'Você não tem quantidade suficiente em carteira para essa venda.', {
                code: 'insufficient_position',
            }),
        )

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'sell', quantity: 10, unitPrice: 30 })

        await waitFor(() => expect(screen.getByText(/Saldo em caixa/)).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Vender' }))

        await waitFor(() => expect(screen.getByText('Você só tem 4 PETR4 disponíveis pra vender.')).toBeInTheDocument())
    })

    // Tarefa J.3: trava só descoberta na confirmação (acesso direto por
    // URL, sem passar pelo banner proativo de `AssetDetail`) mostra o mesmo
    // banner amigável em vez do erro genérico do teste acima.
    it('ProductLockedError na confirmação mostra o banner amigável, não o erro genérico', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockRejectedValue(
            new ApiError(403, 'produto travado', {
                error: 'produto travado',
                key: 'asset:acao',
                unlockingLesson: { code: '2.3', title: 'Nomenclatura de tickers' },
            }),
        )

        renderDialog({ kind: 'order', assetId: 'a1', ticker: 'PETR4', name: 'Petrobras', side: 'buy', quantity: 10, unitPrice: 30 })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        await waitFor(() => expect(screen.getByText('Travado pela trilha')).toBeInTheDocument())
        expect(screen.getByText('Complete a lição "Nomenclatura de tickers" na trilha pra liberar isso.')).toBeInTheDocument()
        expect(screen.queryByText('Não foi possível concluir a operação agora.')).not.toBeInTheDocument()
        // Fase Q: parede total do diálogo — nada do resumo/ações de confirmar.
        expect(screen.queryByText('Ativo')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument()
    })

    // Regressão da tarefa N.2: o 403 nunca traz `id`, só `code`/`title` —
    // `LockedGate` já cai no Mapa da Trilha por omissão de `lessonId`,
    // continua assim mesmo com o campo `reachable` novo (nunca passado aqui).
    it('CTA do banner de trava continua caindo no Mapa da Trilha (403 nunca traz id da lição)', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockRejectedValue(
            new ApiError(403, 'produto travado', {
                error: 'produto travado',
                key: 'asset:acao',
                unlockingLesson: { code: '2.3', title: 'Nomenclatura de tickers' },
            }),
        )

        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const router = createMemoryRouter(
            [
                {
                    path: '/mercado/ativos/:id',
                    element: (
                        <OrderConfirmationDialog
                            draft={{
                                kind: 'order',
                                assetId: 'a1',
                                ticker: 'PETR4',
                                name: 'Petrobras',
                                side: 'buy',
                                quantity: 10,
                                unitPrice: 30,
                            }}
                            onClose={vi.fn()}
                        />
                    ),
                },
                { path: '/trilha', element: <div>mapa da trilha</div> },
            ],
            { initialEntries: ['/mercado/ativos/a1'] },
        )
        render(
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>,
        )

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar Comprar' }))

        await waitFor(() => expect(screen.getByText('Travado pela trilha')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Ir pra lição'))
        await waitFor(() => expect(screen.getByText('mapa da trilha')).toBeInTheDocument())
    })

    it('"Cancelar" chama onClose sem persistir nada', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })

        const { onClose } = renderDialog({
            kind: 'order',
            assetId: 'a1',
            ticker: 'PETR4',
            name: 'Petrobras',
            side: 'buy',
            quantity: 10,
            unitPrice: 30,
        })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(placeOrder).not.toHaveBeenCalled()
        expect(onClose).toHaveBeenCalled()
    })

    it('clique no backdrop (fora do painel) chama onClose', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })

        const { container, onClose } = renderDialog({
            kind: 'order',
            assetId: 'a1',
            ticker: 'PETR4',
            name: 'Petrobras',
            side: 'buy',
            quantity: 10,
            unitPrice: 30,
        })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        const backdrop = container.firstElementChild as HTMLElement
        fireEvent.mouseDown(backdrop)
        expect(onClose).toHaveBeenCalled()
    })

    it('tecla Esc chama onClose', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })

        const { onClose } = renderDialog({
            kind: 'order',
            assetId: 'a1',
            ticker: 'PETR4',
            name: 'Petrobras',
            side: 'buy',
            quantity: 10,
            unitPrice: 30,
        })

        await waitFor(() => expect(screen.getByText('Confirmar ordem')).toBeInTheDocument())
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalled()
    })
})
