import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getIndicatorHistory } from '../../services/market'
import { IndicadoresEconomicos } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ getIndicatorHistory: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/mercado/indicadores', element: <IndicadoresEconomicos /> }], {
        initialEntries: ['/mercado/indicadores'],
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('IndicadoresEconomicos (tela 4.9)', () => {
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

    it('mostra os valores correntes e o próximo Copom a partir do último dia da série', async () => {
        vi.mocked(getIndicatorHistory).mockResolvedValue({
            indicators: [
                { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.003758, ipca_accumulated_12m: 0.0304 },
                { simulated_day: 46, selic_rate: 9.75, ipca_monthly_rate: 0.002307, ipca_accumulated_12m: 0.045321 },
            ],
        })

        renderPage()

        await waitFor(() => expect(screen.getAllByText('9,8%').length).toBeGreaterThan(0))
        expect(screen.getAllByText('4.5%').length).toBeGreaterThan(0)
        // dia 46 está no meio do 3º ciclo de Copom (42-62) — próxima reunião é o dia 63.
        expect(screen.getByText('Dia 63')).toBeInTheDocument()
    })

    it('motor recém-subido (sem histórico) não quebra a tela', async () => {
        vi.mocked(getIndicatorHistory).mockResolvedValue({ indicators: [] })

        renderPage()

        await waitFor(() => expect(screen.getAllByText('Aguardando primeiro tick')).toHaveLength(3))
        expect(screen.getByText('Dia 21')).toBeInTheDocument()
    })

    it('erro do backend mostra mensagem sem quebrar a tela', async () => {
        vi.mocked(getIndicatorHistory).mockRejectedValue(new Error('falhou'))

        renderPage()

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os indicadores agora'))
    })
})
