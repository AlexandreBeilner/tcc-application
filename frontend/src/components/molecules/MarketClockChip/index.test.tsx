import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { RewardRevealProvider } from '../../../features/shell/RewardRevealProvider'
import { getIndicatorHistory, getMarketCalendar, getMarketClock } from '../../../services/market'
import { SATURDAY_CLOCK, WEDNESDAY_CLOCK } from '../../../test/calendarFixtures'
import { MarketClockChip } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/market', () => ({ getMarketClock: vi.fn(), getIndicatorHistory: vi.fn(), getMarketCalendar: vi.fn() }))

function renderChip(open = false, onToggle = vi.fn()) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <RewardRevealProvider>
                <MarketClockChip open={open} onToggle={onToggle} panelId="panel" />
            </RewardRevealProvider>
        </QueryClientProvider>,
    )
    return { queryClient, onToggle }
}

describe('MarketClockChip', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
        vi.mocked(getMarketCalendar).mockResolvedValue({ from_day: 0, to_day: 0, days: [] })
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-07-08T12:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
    })

    it('mercado aberto mostra dia, data e quanto falta pro próximo dia', async () => {
        vi.mocked(getMarketClock).mockResolvedValue(WEDNESDAY_CLOCK)
        renderChip()

        expect(await screen.findByText('Dia 135 · qua 08/07')).toBeInTheDocument()
        expect(screen.getByText('próximo dia em 2h14')).toBeInTheDocument()
        const chip = screen.getByRole('button', { name: /Abrir calendário do mercado\. Dia 135/ })
        expect(chip).toHaveAttribute('aria-expanded', 'false')
        expect(chip).toHaveAttribute('aria-controls', 'panel')
    })

    it('fim de semana mostra o selo "Mercado fechado" em texto e quando reabre', async () => {
        vi.mocked(getMarketClock).mockResolvedValue({ ...SATURDAY_CLOCK, next_tick_at: '2026-07-08T12:30:00Z' })
        renderChip()

        expect(await screen.findByText('Mercado fechado')).toBeInTheDocument()
        expect(screen.getByText(/^Abre em 5h18, segunda 13\/07$/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Dia 138, sáb 11\/07\. Mercado fechado/ })).toBeInTheDocument()
    })

    it('sem agenda automática some o "próximo dia em"', async () => {
        vi.mocked(getMarketClock).mockResolvedValue({ ...WEDNESDAY_CLOCK, next_tick_at: null })
        renderChip()

        expect(await screen.findByText('Dia 135 · qua 08/07')).toBeInTheDocument()
        expect(screen.queryByText(/próximo dia em/)).not.toBeInTheDocument()
    })

    it('não renderiza nada enquanto o relógio não carregou', () => {
        vi.mocked(getMarketClock).mockReturnValue(new Promise(() => {}))
        renderChip()

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('clicar chama onToggle e o rótulo muda quando aberto', async () => {
        vi.mocked(getMarketClock).mockResolvedValue(WEDNESDAY_CLOCK)
        const { onToggle } = renderChip(true)

        const chip = await screen.findByRole('button', { name: /Fechar calendário do mercado/ })
        expect(chip).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(chip)
        expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('virada de dia mostra o toast "Novo dia: Selic X%" e o ponteiro gira', async () => {
        vi.mocked(getMarketClock).mockResolvedValueOnce(WEDNESDAY_CLOCK)
        vi.mocked(getIndicatorHistory).mockResolvedValue({
            indicators: [
                { simulated_day: 135, selic_rate: 10.75, ipca_monthly_rate: 0.4, ipca_accumulated_12m: 4 },
                { simulated_day: 136, selic_rate: 10.5, ipca_monthly_rate: 0.4, ipca_accumulated_12m: 4 },
            ],
        })
        const { queryClient } = renderChip()
        await screen.findByText('Dia 135 · qua 08/07')
        expect(screen.queryByText(/Novo dia/)).not.toBeInTheDocument()

        vi.mocked(getMarketClock).mockResolvedValue({ ...WEDNESDAY_CLOCK, simulated_day: 136, date: '2026-07-09', weekday: 'thu' })
        await queryClient.invalidateQueries({ queryKey: ['market', 'clock'] })

        expect(await screen.findByText('Novo dia: Selic 10,50%')).toBeInTheDocument()
        expect(screen.getByText('quinta 09/07: mercado aberto')).toBeInTheDocument()
        await waitFor(() => expect(getIndicatorHistory).toHaveBeenCalledWith('token', 1))
    })

    it('virada de dia com salário pago mostra o toast dedicado ao lado do de virada de dia', async () => {
        vi.mocked(getMarketClock).mockResolvedValueOnce(WEDNESDAY_CLOCK)
        vi.mocked(getIndicatorHistory).mockResolvedValue({
            indicators: [{ simulated_day: 136, selic_rate: 10.5, ipca_monthly_rate: 0.4, ipca_accumulated_12m: 4 }],
        })
        vi.mocked(getMarketCalendar).mockResolvedValue({
            from_day: 136,
            to_day: 136,
            days: [
                {
                    simulated_day: 136,
                    date: '2026-07-09',
                    weekday: 'thu',
                    market_open: true,
                    events: [{ kind: 'salary_payment', scope: 'user', future: false, unit_value: 1000 }],
                },
            ],
        })
        const { queryClient } = renderChip()
        await screen.findByText('Dia 135 · qua 08/07')

        vi.mocked(getMarketClock).mockResolvedValue({ ...WEDNESDAY_CLOCK, simulated_day: 136, date: '2026-07-09', weekday: 'thu' })
        await queryClient.invalidateQueries({ queryKey: ['market', 'clock'] })

        expect(await screen.findByText('Novo dia: Selic 10,50%')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))

        expect(await screen.findByText('Salário do mês')).toBeInTheDocument()
        expect(screen.getByText(/^R\$\s1\.000,00 caiu na sua conta$/)).toBeInTheDocument()
        expect(getMarketCalendar).toHaveBeenCalledWith('token', '2026-07-09', '2026-07-09')
    })

    it('virada pro sábado convida a estudar', async () => {
        vi.mocked(getMarketClock).mockResolvedValueOnce({ ...WEDNESDAY_CLOCK, simulated_day: 137, date: '2026-07-10', weekday: 'fri' })
        vi.mocked(getIndicatorHistory).mockRejectedValue(new Error('fora do ar'))
        const { queryClient } = renderChip()
        await screen.findByText('Dia 137 · sex 10/07')

        vi.mocked(getMarketClock).mockResolvedValue(SATURDAY_CLOCK)
        await queryClient.invalidateQueries({ queryKey: ['market', 'clock'] })

        expect(await screen.findByText('Novo dia: fim de semana')).toBeInTheDocument()
        expect(screen.getByText('Mercado fechado até segunda. Hora de estudar.')).toBeInTheDocument()
    })
})
