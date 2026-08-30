import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAssets, listMyEvents } from '../../services/market'
import { Statement } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ listMyEvents: vi.fn(), listAssets: vi.fn() }))

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
        vi.mocked(listAssets).mockResolvedValue({ assets: [] })
    })

    afterEach(() => vi.clearAllMocks())

    it('lista os eventos do extrato', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events })
        renderPage()
        await waitFor(() => expect(screen.getByText('Depósito inicial')).toBeInTheDocument())
        expect(screen.getByText('Compra executada')).toBeInTheDocument()
    })

    it('resolve asset_id (UUID) pro ticker/nome do ativo, sem expor o UUID cru', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events })
        vi.mocked(listAssets).mockResolvedValue({
            assets: [
                {
                    id: 'a1',
                    ticker: 'PETR4',
                    name: 'Petrobras',
                    type: 'acao',
                    is_sandbox: false,
                },
            ],
        })
        renderPage()
        await waitFor(() => expect(screen.getByText('Compra executada')).toBeInTheDocument())

        fireEvent.click(screen.getByText('Compra executada'))
        expect(await screen.findByText('PETR4 · Petrobras')).toBeInTheDocument()
        expect(screen.queryByText('a1')).not.toBeInTheDocument()
    })

    it('filtro por tipo mostra só os eventos daquele tipo', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events })
        renderPage()
        await waitFor(() => expect(screen.getByText('Depósito inicial')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Tipo' }))
        fireEvent.click(screen.getByRole('option', { name: 'Compra executada' }))

        expect(screen.queryByText('Depósito inicial')).not.toBeInTheDocument()
        // "Compra executada" aparece 2x: o gatilho do filtro (agora selecionado
        // nesse tipo) e a linha do extrato.
        expect(screen.getAllByText('Compra executada').length).toBe(2)
    })

    it('filtro por período exclui eventos antigos', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events })
        renderPage()
        await waitFor(() => expect(screen.getByText('Depósito inicial')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Período' }))
        fireEvent.click(screen.getByRole('option', { name: 'Últimos 30 dias' }))

        expect(screen.queryByText('Depósito inicial')).not.toBeInTheDocument()
        expect(screen.getByText('Compra executada')).toBeInTheDocument()
    })

    it('estado vazio sem nenhuma transação', async () => {
        vi.mocked(listMyEvents).mockResolvedValue({ events: [] })
        renderPage()
        await waitFor(() => expect(screen.getByText('Você ainda não tem nenhuma transação registrada.')).toBeInTheDocument())
    })
})
