import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listMyEvents } from '../../services/market'
import { Statement } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ listMyEvents: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <Statement />
        </QueryClientProvider>,
    )
}

const events = [
    { id: 'e1', event_type: 'initial_deposit', unit_value: 10000, timestamp: '2020-01-01T00:00:00Z' },
    { id: 'e2', event_type: 'buy_order_executed', asset_id: 'a1', quantity: 10, unit_value: 30, timestamp: new Date().toISOString() },
]

describe('Statement (tela 4.8)', () => {
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

    it('lista os eventos do extrato', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events })
        renderPage()
        await waitFor(() => expect(screen.getByText('Depósito inicial')).toBeInTheDocument())
        expect(screen.getByText('Compra executada')).toBeInTheDocument()
    })

    it('filtro por tipo mostra só os eventos daquele tipo', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events })
        renderPage()
        // "Depósito inicial" existe 2x antes do filtro (option do <select> +
        // resumo da linha do extrato) — só a linha some ao filtrar, a option
        // continua no <select> (por isso a contagem, não `queryByText`).
        await waitFor(() => expect(screen.getAllByText('Depósito inicial').length).toBe(2))

        fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'buy_order_executed' } })
        expect(screen.getAllByText('Depósito inicial').length).toBe(1)
        expect(screen.getAllByText('Compra executada').length).toBe(2)
    })

    it('filtro por período exclui eventos antigos', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events })
        renderPage()
        await waitFor(() => expect(screen.getAllByText('Depósito inicial').length).toBe(2))

        fireEvent.change(screen.getByLabelText('Período'), { target: { value: '30' } })
        expect(screen.getAllByText('Depósito inicial').length).toBe(1)
        expect(screen.getAllByText('Compra executada').length).toBe(2)
    })

    it('estado vazio sem nenhuma transação', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events: [] })
        renderPage()
        await waitFor(() => expect(screen.getByText('Você ainda não tem nenhuma transação registrada.')).toBeInTheDocument())
    })
})
