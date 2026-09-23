import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listMyOrders } from '../../services/market'
import { MinhasOrdens } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ listMyOrders: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MinhasOrdens />
        </QueryClientProvider>,
    )
}

describe('MinhasOrdens (tela 4.10, tarefa O.4)', () => {
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

    it('renderiza ordens reais de GET /market/orders', async () => {
        vi.mocked(listMyOrders).mockResolvedValue({
            orders: [
                {
                    order_id: 'o1',
                    asset_id: 'a1',
                    ticker: 'VALR3',
                    name: 'Valorização SA',
                    side: 'buy',
                    type: 'limit',
                    quantity: 10,
                    filled_quantity: 0,
                    price: 25.5,
                    status: 'pending',
                    created_at: '2026-09-20T12:00:00.000Z',
                },
            ],
        })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('VALR3 · Valorização SA').length).toBeGreaterThan(0))
    })

    it('mostra erro se GET /market/orders falhar', async () => {
        vi.mocked(listMyOrders).mockRejectedValue(new Error('falhou'))
        renderPage()
        await waitFor(() =>
            expect(screen.getByText('Não foi possível carregar suas ordens agora. Tente novamente em instantes.')).toBeInTheDocument(),
        )
    })
})
