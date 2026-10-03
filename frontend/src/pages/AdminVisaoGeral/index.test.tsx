import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAdminOverview, getSystemHealth } from '../../services/admin'
import type { AdminOverview, SystemHealth } from '../../services/admin'
import { AdminVisaoGeral } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getSystemHealth: vi.fn(), getAdminOverview: vi.fn() }))

const health: SystemHealth = {
    checked_at: '2026-10-03T12:00:00Z',
    components: [
        { key: 'backend', status: 'ok', latency_ms: 0, detail: null },
        { key: 'engine', status: 'ok', latency_ms: 12, detail: null },
        { key: 'gamification_db', status: 'ok', latency_ms: 3, detail: null },
        { key: 'market_db', status: 'ok', latency_ms: 20, detail: null },
        { key: 'redis', status: 'fora', latency_ms: null, detail: 'ECONNREFUSED' },
    ],
}

const overview: AdminOverview = {
    market: {
        simulated_day: 120,
        selic_rate: 10.75,
        ipca_monthly: 0.42,
        ipca_accumulated_12m: 4.8,
        pending_macro_events: 2,
        uncovered_assets: 1,
        tradable_assets: 5,
        active_bots: 3,
        total_bots: 4,
        day_trades: 9,
        day_volume: 1234.5,
        resting_orders: 17,
    },
    scheduler: {
        enabled: true,
        paused: true,
        resumed_at: null,
        ticks_per_day: 5,
        timezone: 'America/Sao_Paulo',
        max_catch_up: 3,
        next_slot_at: '2026-10-03T15:00:00Z',
        tick_in_progress: false,
        last_tick_at: '2026-10-03T10:00:00Z',
    },
    last_tick: {
        simulated_day: 120,
        trigger: 'manual',
        status: 'success',
        error_message: null,
        started_at: '2026-10-03T12:00:00Z',
        duration_ms: 900,
        catch_up_discarded: 0,
        selic_rate: 10.75,
        is_copom_day: false,
        is_report_day: false,
        quotes_count: 5,
        fundamentals_count: 0,
        dividends_generated_count: 0,
        dividends_paid_count: 0,
        bot_fills_count: 4,
        expired_orders_count: 0,
        uncovered_assets_count: 0,
        intraday_rounds_count: 2,
    },
    users: { total: 42, signups_last_24h: 3, signups_last_7d: 11 },
    errors: {},
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminVisaoGeral />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('AdminVisaoGeral (tela 10.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
        vi.mocked(getSystemHealth).mockReset().mockResolvedValue(health)
        vi.mocked(getAdminOverview).mockReset().mockResolvedValue(overview)
    })

    it('mostra a saúde dos componentes, com o que está fora destacado', async () => {
        renderPage()
        expect(await screen.findByLabelText('Saúde do sistema')).toBeInTheDocument()
        expect(screen.getByText('Redis').closest('li')).toHaveTextContent('Fora')
        expect(screen.getByText('Motor').closest('li')).toHaveTextContent('No ar')
    })

    it('mostra mercado, tempo, negociação e usuários', async () => {
        renderPage()
        expect(await screen.findByText('Dia simulado')).toBeInTheDocument()
        expect(screen.getByText('120')).toBeInTheDocument()
        expect(screen.getByText('10,75%')).toBeInTheDocument()
        expect(screen.getByText('1 de 5')).toBeInTheDocument()
        expect(screen.getByText('Pausada')).toBeInTheDocument()
        expect(screen.getByText('R$ 1.234,50')).toBeInTheDocument()
        expect(screen.getByText('3 de 4')).toBeInTheDocument()
        expect(screen.getByText('42')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Controlar o tempo' })).toHaveAttribute('href', '/admin/tempo')
        expect(screen.getByRole('link', { name: 'Eventos macro' })).toHaveAttribute('href', '/admin/eventos')
    })

    it('uma fonte fora vira aviso naquele cartão e os outros seguem', async () => {
        vi.mocked(getAdminOverview).mockResolvedValue({ ...overview, market: null, errors: { market: 'motor fora' } })
        renderPage()
        expect(await screen.findAllByText('Indisponível: motor fora')).toHaveLength(2)
        expect(screen.getByText('42')).toBeInTheDocument()
        expect(screen.getByText('Pausada')).toBeInTheDocument()
    })

    it('backend fora do ar mostra os dois avisos sem quebrar a tela', async () => {
        vi.mocked(getSystemHealth).mockRejectedValue(new Error('rede'))
        vi.mocked(getAdminOverview).mockRejectedValue(new Error('rede'))
        renderPage()
        expect(await screen.findByText(/Não foi possível consultar a saúde/)).toBeInTheDocument()
        expect(await screen.findByText(/Não foi possível carregar o resumo/)).toBeInTheDocument()
    })
})
