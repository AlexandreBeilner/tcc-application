import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import type { MyOrderRecord } from '../../../services/market'
import { cancelOrder } from '../../../services/market'
import { OrdersList } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({ cancelOrder: vi.fn() }))

function renderList(orders: MyOrderRecord[]) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <OrdersList orders={orders} />
        </QueryClientProvider>,
    )
}

const pendingOrder: MyOrderRecord = {
    order_id: 'o1',
    asset_id: 'a1',
    ticker: 'VALR3',
    name: 'Valorização SA',
    side: 'buy',
    type: 'limit',
    quantity: 10,
    filled_quantity: 4,
    price: 25.5,
    status: 'partially_filled',
    created_at: '2026-09-20T12:00:00.000Z',
}

const filledOrder: MyOrderRecord = {
    order_id: 'o2',
    asset_id: 'a2',
    ticker: 'SAND3',
    name: 'Sandbox SA',
    side: 'sell',
    type: 'market',
    quantity: 5,
    filled_quantity: 5,
    price: 10,
    status: 'filled',
    created_at: '2026-09-19T12:00:00.000Z',
}

const cancelledOrder: MyOrderRecord = {
    order_id: 'o3',
    asset_id: 'a1',
    ticker: 'VALR3',
    name: 'Valorização SA',
    side: 'buy',
    type: 'limit',
    quantity: 8,
    filled_quantity: 0,
    price: 20,
    status: 'cancelled',
    cancel_reason: 'expired',
    created_at: '2026-09-18T12:00:00.000Z',
}

describe('OrdersList (tela Minhas Ordens, O.4)', () => {
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

    it('aba Pendentes (padrão) agrupa pending + partially_filled, quantidade mostra preenchida/total', () => {
        renderList([pendingOrder, filledOrder, cancelledOrder])
        expect(screen.getAllByText('VALR3 · Valorização SA').length).toBeGreaterThan(0)
        expect(screen.getAllByText('4/10').length).toBeGreaterThan(0)
        expect(screen.queryByText('SAND3 · Sandbox SA')).not.toBeInTheDocument()
    })

    it('aba Executadas mostra só ordens filled, aba Recusadas mostra o motivo humanizado', () => {
        renderList([pendingOrder, filledOrder, cancelledOrder])

        fireEvent.click(screen.getByRole('tab', { name: 'Executadas' }))
        expect(screen.getAllByText('SAND3 · Sandbox SA').length).toBeGreaterThan(0)
        expect(screen.queryByText('VALR3 · Valorização SA')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('tab', { name: 'Recusadas' }))
        expect(screen.getAllByText('Expirada no fechamento do dia').length).toBeGreaterThan(0)
    })

    it('estado vazio numa aba sem ordens', () => {
        renderList([filledOrder])
        expect(screen.getByText('Você não tem nenhuma ordem pendente no momento.')).toBeInTheDocument()
    })

    it('cancelar ordem exige confirmação em duas etapas e chama a mutation (O.1)', async () => {
        vi.mocked(cancelOrder).mockResolvedValue(undefined)
        renderList([pendingOrder])

        fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar ordem' })[0])
        expect(screen.getAllByRole('button', { name: 'Confirmar cancelamento' }).length).toBeGreaterThan(0)

        fireEvent.click(screen.getAllByRole('button', { name: 'Voltar' })[0])
        expect(screen.getAllByRole('button', { name: 'Cancelar ordem' }).length).toBeGreaterThan(0)

        fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar ordem' })[0])
        fireEvent.click(screen.getAllByRole('button', { name: 'Confirmar cancelamento' })[0])
        await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith('token', 'o1'))
    })
})
