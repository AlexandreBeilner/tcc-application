import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listMarketMonitor, listTradingHalts } from '../../services/admin'
import type { MonitorAsset } from '../../services/admin'
import { getIndicatorHistory, getMarketCalendar, getMarketClock } from '../../services/market'
import { calendarDay, calendarWindow } from '../../test/calendarFixtures'
import { AdminMercado } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ listMarketMonitor: vi.fn(), listTradingHalts: vi.fn() }))
vi.mock('../../services/market', () => ({
    getIndicatorHistory: vi.fn(),
    getMarketClock: vi.fn(),
    getMarketCalendar: vi.fn(),
}))

function asset(overrides: Partial<MonitorAsset>): MonitorAsset {
    return {
        asset_id: 'a1',
        ticker: 'ACME3',
        name: 'Acme ON',
        type: 'acao',
        sector: 'Energia',
        last_price: 22,
        daily_change_pct: 10,
        best_bid: 21.8,
        best_ask: 22.2,
        spread_pct: 1.8,
        resting_orders: 3,
        bot_resting_orders: 2,
        day_trades: 1,
        day_volume: 10,
        outstanding_shares: 1000,
        held_by_bots: 300,
        held_by_users: 40,
        covered: true,
        indicator: { kind: 'price_to_earnings', value: 11 },
        ...overrides,
    }
}

const assets = [
    asset({ asset_id: 'a1', ticker: 'ACME3' }),
    asset({ asset_id: 'a2', ticker: 'BETA3', name: 'Beta ON', sector: 'Varejo', daily_change_pct: -3, covered: false }),
    asset({
        asset_id: 'a3',
        ticker: 'ETFX11',
        name: 'ETF X',
        type: 'etf',
        sector: null,
        daily_change_pct: null,
        indicator: { kind: 'nav_premium_pct', value: -1.5 },
    }),
]

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminMercado />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

function pick(trigger: string, option: string) {
    fireEvent.click(screen.getByRole('button', { name: trigger }))
    fireEvent.click(screen.getByRole('option', { name: option }))
}

function tickers(): string[] {
    const table = screen.getAllByRole('table')[0]
    return within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('link')[0].textContent ?? '')
}

describe('AdminMercado (tela 10.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
        vi.mocked(listMarketMonitor).mockReset().mockResolvedValue({ assets })
        vi.mocked(listTradingHalts).mockReset().mockResolvedValue({ active: [], recent: [] })
        vi.mocked(getIndicatorHistory)
            .mockReset()
            .mockResolvedValue({
                indicators: [{ simulated_day: 42, selic_rate: 10.75, ipca_monthly_rate: 0.004, ipca_accumulated_12m: 0.05 }],
            })
        vi.mocked(getMarketClock).mockReset().mockResolvedValue({
            simulated_day: 42,
            date: '2027-01-13',
            weekday: 'wed',
            market_open: true,
            days_until_open: 0,
            days_per_real_day: 5,
            next_tick_at: null,
            quarter_day: 9,
            quarter_length: 91,
        })
        vi.mocked(getMarketCalendar)
            .mockReset()
            .mockResolvedValue({
                ...calendarWindow(42, 72),
                days: [
                    calendarDay({ simulated_day: 50, date: '2027-01-21', weekday: 'thu', market_open: true }, [
                        { kind: 'copom', scope: 'global', future: true },
                        { kind: 'order_executed', scope: 'user', future: false, ticker: 'ACME3', side: 'buy' },
                    ]),
                ],
            })
    })

    it('lista os ativos ordenados por ticker e avisa os sem Market Maker', async () => {
        renderPage()
        expect(await screen.findByRole('link', { name: 'ACME3' })).toHaveAttribute('href', '/admin/mercado/ativos/a1')
        expect(tickers()).toEqual(['ACME3', 'BETA3', 'ETFX11'])
        expect(screen.getByRole('status')).toHaveTextContent('1 ativo está sem Market Maker ativo cobrindo.')
    })

    it('filtra por classe, por setor e por texto', async () => {
        renderPage()
        await screen.findByRole('link', { name: 'ACME3' })

        pick('Filtrar por classe', 'ETF')
        expect(tickers()).toEqual(['ETFX11'])

        pick('Filtrar por classe', 'Todas')
        pick('Filtrar por setor', 'Varejo')
        expect(tickers()).toEqual(['BETA3'])

        pick('Filtrar por setor', 'Todos')
        fireEvent.change(screen.getByPlaceholderText('Ticker ou nome'), { target: { value: 'acme' } })
        expect(tickers()).toEqual(['ACME3'])

        fireEvent.change(screen.getByPlaceholderText('Ticker ou nome'), { target: { value: 'zzz' } })
        expect(screen.getByText('Nenhum ativo para esses filtros.')).toBeInTheDocument()
    })

    it('ordena pela variação ao clicar no cabeçalho e inverte no segundo clique', async () => {
        renderPage()
        await screen.findByRole('link', { name: 'ACME3' })

        fireEvent.click(screen.getByRole('button', { name: /Variação/ }))
        expect(tickers()).toEqual(['ACME3', 'BETA3', 'ETFX11'])
        fireEvent.click(screen.getByRole('button', { name: /Variação/ }))
        expect(tickers()).toEqual(['BETA3', 'ACME3', 'ETFX11'])
    })

    it('mostra o indicador macro e só os próximos eventos globais', async () => {
        renderPage()
        expect((await screen.findAllByText('Selic (meta anual)')).length).toBeGreaterThan(0)
        const calendar = screen.getByRole('complementary', { name: 'Próximos eventos' })
        expect(await within(calendar).findByText('Reunião do Copom')).toBeInTheDocument()
        expect(within(calendar).getAllByRole('listitem')).toHaveLength(1)
    })

    it('motor fora do ar mostra o aviso sem quebrar a tela', async () => {
        vi.mocked(listMarketMonitor).mockRejectedValue(new Error('rede'))
        renderPage()
        expect(await screen.findByText(/Não foi possível carregar o mercado/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Eventos macro' })).toHaveAttribute('href', '/admin/eventos')
    })

    it('mostra o aviso de pausa vigente com link para as pausas', async () => {
        const global = {
            id: 'h1',
            scope: 'global' as const,
            asset_id: null,
            ticker: null,
            reason: 'm',
            created_by: 'a',
            created_at: '2026-10-03T12:00:00Z',
            lifted_at: null,
            lifted_by: null,
        }
        vi.mocked(listTradingHalts).mockResolvedValue({ active: [global], recent: [] })
        renderPage()
        expect(await screen.findByText(/Negociação pausada em todo o mercado/)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Ver pausas' })).toHaveAttribute('href', '/admin/mercado/pausas')
        expect(screen.getByRole('link', { name: 'Pausas' })).toHaveAttribute('href', '/admin/mercado/pausas')
    })

    it('sem pausa não mostra aviso', async () => {
        renderPage()
        await screen.findAllByText('ACME3')
        expect(screen.queryByText(/Negociação pausada/)).not.toBeInTheDocument()
    })
})
