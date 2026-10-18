import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getAdminRetention } from '../../services/admin'
import type { AdminRetention } from '../../services/admin'
import { AdminRetencao } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({ getAdminRetention: vi.fn() }))

const cell = (status: 'complete' | 'partial' | 'in_progress' | 'no_data', rate: number | null) => ({ status, rate, measured: 10, size: 10 })

const DATA: AdminRetention = {
    cohorts: {
        tracking_since: { presence: '2026-06-01', activity: '2026-05-01' },
        cohorts: [
            {
                cohort_week: '2026-10-12',
                size: 12,
                returned: { d1: cell('partial', 0.4), d7: cell('in_progress', null), d30: cell('in_progress', null) },
                studied: { d1: cell('partial', 0.2), d7: cell('in_progress', null), d30: cell('in_progress', null) },
            },
        ],
    },
    active: {
        tracking_since: { presence: '2026-06-01', activity: '2026-05-01' },
        days: [
            { day: '2026-10-15', returned: 80, studied: 30, mau: 400, dau_mau: 0.2 },
            { day: '2026-10-16', returned: 95, studied: 41, mau: 410, dau_mau: 95 / 410 },
            { day: '2026-10-17', returned: 120, studied: 52, mau: 420, dau_mau: 120 / 420 },
        ],
    },
    milestones: {
        tracking_since: '2026-06-02',
        eligible: 50,
        milestones: [
            { milestone: 'first_return', granularity: 'day', reached: 20, reached_rate: 0.4, median_seconds: 86_400 },
            { milestone: 'first_lesson', granularity: 'second', reached: 30, reached_rate: 0.6, median_seconds: 7200 },
            { milestone: 'first_trade', granularity: 'second', reached: 10, reached_rate: 0.2, median_seconds: 172_800 },
            { milestone: 'first_fixed_income', granularity: 'second', reached: 0, reached_rate: 0, median_seconds: null },
            { milestone: 'first_daily', granularity: 'second', reached: 5, reached_rate: 0.1, median_seconds: 600 },
        ],
        cohorts: [],
    },
}

function renderPage() {
    vi.mocked(useAuth).mockReturnValue({ token: 'tk' } as ReturnType<typeof useAuth>)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AdminRetencao />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('AdminRetencao (RT.1.3)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('mostra ontem, as coortes, os gráficos e o tempo até os marcos', async () => {
        vi.mocked(getAdminRetention).mockResolvedValue(DATA)
        renderPage()

        const yesterday = await screen.findByRole('region', { name: 'Ontem (17/10)' })
        expect(within(yesterday).getByText('Voltaram (DAU)').nextSibling).toHaveTextContent('120')
        expect(within(yesterday).getByText('Estudaram').nextSibling).toHaveTextContent('52')
        expect(within(yesterday).getByText('DAU/MAU').nextSibling).toHaveTextContent('28,6%')

        const cohorts = screen.getByRole('region', { name: 'Tabela de coortes semanais' })
        expect(within(cohorts).getByText('12/10 a 18/10')).toBeInTheDocument()
        expect(within(cohorts).getAllByText('em andamento').length).toBeGreaterThan(0)

        expect(screen.getAllByTestId('retention-line-chart')).toHaveLength(2)
        const cards = screen.getByRole('list', { name: 'Tempo até cada marco' })
        expect(within(cards).getAllByRole('listitem')).toHaveLength(5)
    })

    it('consulta com 12 semanas e 60 dias e refaz a consulta ao trocar as janelas', async () => {
        vi.mocked(getAdminRetention).mockResolvedValue(DATA)
        renderPage()
        await screen.findByRole('region', { name: 'Ontem (17/10)' })
        expect(getAdminRetention).toHaveBeenCalledWith('tk', { weeks: 12, days: 60 })

        fireEvent.click(screen.getByRole('button', { name: '26 semanas' }))
        await screen.findByRole('button', { name: '26 semanas', pressed: true })
        expect(getAdminRetention).toHaveBeenCalledWith('tk', { weeks: 26, days: 60 })

        fireEvent.click(screen.getByRole('button', { name: '180 dias' }))
        await screen.findByRole('button', { name: '180 dias', pressed: true })
        expect(getAdminRetention).toHaveBeenCalledWith('tk', { weeks: 26, days: 180 })
    })

    it('sem registro de presença ainda, diz isso em vez de mostrar zeros', async () => {
        vi.mocked(getAdminRetention).mockResolvedValue({
            ...DATA,
            active: {
                tracking_since: { presence: null, activity: null },
                days: [{ day: '2026-10-17', returned: null, studied: null, mau: null, dau_mau: null }],
            },
        })
        renderPage()
        const yesterday = await screen.findByRole('region', { name: 'Ontem (17/10)' })
        expect(within(yesterday).getAllByText('sem dado')).toHaveLength(4)
        expect(screen.getByText(/Ainda sem registro de presença/)).toBeInTheDocument()
    })

    it('erro ao carregar vira aviso', async () => {
        vi.mocked(getAdminRetention).mockRejectedValue(new Error('x'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o painel de retenção')
    })

    it('não usa travessão como pontuação nos textos da tela', async () => {
        vi.mocked(getAdminRetention).mockResolvedValue(DATA)
        const { container } = renderPage()
        await screen.findByRole('region', { name: 'Ontem (17/10)' })
        expect(container.textContent).not.toContain('—')
    })
})
