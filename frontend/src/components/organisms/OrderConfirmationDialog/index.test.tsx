import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getAsset, getMyAccount, placeOrder, purchaseFixedIncome, redeemFixedIncome } from '../../../services/market'
import type { OrderDraft } from './types'
import { OrderConfirmationDialog } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({
    getAsset: vi.fn(),
    getMyAccount: vi.fn(),
    placeOrder: vi.fn(),
    purchaseFixedIncome: vi.fn(),
    redeemFixedIncome: vi.fn(),
}))

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
    })

    afterEach(() => vi.clearAllMocks())

    it('ordem de compra: mostra o resumo e confirma via POST /market/orders', async () => {
        vi.mocked(getAsset).mockResolvedValue({
            asset: { id: 'a1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false, current_price: 30 },
        })
        vi.mocked(placeOrder).mockResolvedValue({ filled_quantity: 10, remaining_quantity: 0, fills: [] })

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
