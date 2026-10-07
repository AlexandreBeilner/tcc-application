import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getIndicatorHistory } from '../../../services/market'
import { SelicIpcaChartWidget } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({ getIndicatorHistory: vi.fn() }))

function renderWidget() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <SelicIpcaChartWidget windowDays={365} />
        </QueryClientProvider>,
    )
}

describe('SelicIpcaChartWidget', () => {
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

    it('desenha as duas séries e diz onde o IPCA está em relação à faixa da meta', async () => {
        vi.mocked(getIndicatorHistory).mockResolvedValue({
            indicators: [
                { simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.003, ipca_accumulated_12m: 0.03 },
                { simulated_day: 22, selic_rate: 10.5, ipca_monthly_rate: 0.004, ipca_accumulated_12m: 0.0521 },
            ],
        })

        renderWidget()

        await waitFor(() => expect(screen.getByRole('img', { name: /Selic e do IPCA/ })).toBeInTheDocument())
        expect(screen.getByText(/Selic atual: 10,50%/)).toBeInTheDocument()
        expect(screen.getByText(/5,21%, acima da faixa da meta/)).toBeInTheDocument()
    })

    it('histórico curto demais avisa em vez de desenhar', async () => {
        vi.mocked(getIndicatorHistory).mockResolvedValue({
            indicators: [{ simulated_day: 1, selic_rate: 10, ipca_monthly_rate: 0.003, ipca_accumulated_12m: 0.03 }],
        })

        renderWidget()

        await waitFor(() => expect(screen.getByText(/Ainda não há histórico suficiente/)).toBeInTheDocument())
    })
})
