import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminReauthProvider } from '../../features/admin/AdminReauth'
import { useAuth } from '../../features/auth/AuthContext'
import { advanceTicks, getScheduler, listTicks, pauseScheduler, resumeScheduler, triggerTick } from '../../services/admin'
import type { SchedulerStatus } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminTempo } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    getScheduler: vi.fn(),
    listTicks: vi.fn(),
    pauseScheduler: vi.fn(),
    resumeScheduler: vi.fn(),
    triggerTick: vi.fn(),
    advanceTicks: vi.fn(),
}))

const status: SchedulerStatus = {
    enabled: true,
    paused: false,
    resumed_at: null,
    ticks_per_day: 5,
    timezone: 'America/Sao_Paulo',
    max_catch_up: 3,
    next_slot_at: '2026-10-03T15:00:00Z',
    tick_in_progress: false,
    last_tick_at: '2026-10-03T10:00:00Z',
}

const tickRun = {
    simulated_day: 12,
    trigger: 'scheduled' as const,
    status: 'success' as const,
    error_message: null,
    started_at: '2026-10-03T12:00:00Z',
    duration_ms: 1500,
    catch_up_discarded: 0,
    selic_rate: 10.5,
    is_copom_day: false,
    is_report_day: false,
    quotes_count: 24,
    fundamentals_count: 0,
    dividends_generated_count: 0,
    dividends_paid_count: 0,
    bot_fills_count: 7,
    expired_orders_count: 0,
    uncovered_assets_count: 0,
    intraday_rounds_count: 3,
}

const tickResult = {
    day: 13,
    selic_rate: 10.5,
    quotes_count: 24,
    fundamentals_count: 0,
    is_copom_day: false,
    is_report_day: false,
    dividends_generated_count: 0,
    dividends_paid_count: 0,
    bot_fills_count: 0,
    expired_orders_count: 0,
    uncovered_assets_count: 0,
    intraday_rounds_count: 2,
}

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AdminReauthProvider>
                    <AdminTempo />
                </AdminReauthProvider>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('AdminTempo (tela 10.5)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getScheduler).mockResolvedValue(status)
        vi.mocked(listTicks).mockResolvedValue({ ticks: [tickRun], total_entries: 1 })
    })

    afterEach(() => vi.clearAllMocks())

    it('carrega o estado da agenda e o histórico de ticks', async () => {
        renderPage()
        expect(await screen.findByText('Ativa')).toBeInTheDocument()
        expect(await screen.findByText('Dia 12')).toBeInTheDocument()
        expect(screen.getByText('1 tick(s) registrado(s)')).toBeInTheDocument()
        expect(listTicks).toHaveBeenCalledWith('token', 20, 0)
    })

    it('pausar chama o serviço e avisa; retomar faz o inverso', async () => {
        const paused = { ...status, paused: true, next_slot_at: null }
        vi.mocked(pauseScheduler).mockResolvedValue(paused)
        // Primeira leitura: ativa; depois da pausa o refetch já vê o estado novo.
        vi.mocked(getScheduler).mockResolvedValueOnce(status).mockResolvedValue(paused)
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Pausar agenda' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Agenda pausada.')
        expect(pauseScheduler).toHaveBeenCalledWith('token')

        vi.mocked(resumeScheduler).mockResolvedValue(status)
        fireEvent.click(await screen.findByRole('button', { name: 'Retomar agenda' }))
        await waitFor(() => expect(resumeScheduler).toHaveBeenCalledWith('token'))
    })

    it('pausar com a agenda desligada no ambiente mostra o erro 409', async () => {
        vi.mocked(pauseScheduler).mockRejectedValue(new ApiError(409, 'desligada'))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Pausar agenda' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um tick em andamento')
    })

    it('disparar 1 tick pede confirmação com o aviso de mercado compartilhado, e só depois chama', async () => {
        vi.mocked(triggerTick).mockResolvedValue(tickResult)
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Disparar 1 tick' }))

        const dialog = screen.getByRole('dialog', { name: 'Disparar 1 tick agora?' })
        expect(dialog).toHaveTextContent('afeta todos os usuários')
        expect(triggerTick).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Disparar tick' }))
        expect(await screen.findByRole('status')).toHaveTextContent('Tick executado: dia simulado 13.')
        expect(triggerTick).toHaveBeenCalledWith('token')
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('cancelar a confirmação não dispara nada', async () => {
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Disparar 1 tick' }))
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(triggerTick).not.toHaveBeenCalled()
    })

    it('tick com 409 mostra o erro e fecha o diálogo', async () => {
        vi.mocked(triggerTick).mockRejectedValue(new ApiError(409, 'já existe um tick em andamento'))
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Disparar 1 tick' }))
        fireEvent.click(screen.getByRole('button', { name: 'Disparar tick' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um tick em andamento')
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('avançar N dias confirma e resume até onde foi', async () => {
        vi.mocked(advanceTicks).mockResolvedValue({
            requested: 3,
            ticks: [tickResult, { ...tickResult, day: 14 }, { ...tickResult, day: 15 }],
        })
        renderPage()
        await screen.findByText('Ativa')
        fireEvent.change(screen.getByLabelText('Avançar dias do mercado'), { target: { value: '3' } })
        fireEvent.click(screen.getByRole('button', { name: 'Avançar' }))

        expect(screen.getByRole('dialog', { name: 'Avançar 3 dia(s) do mercado?' })).toBeInTheDocument()
        expect(advanceTicks).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Avançar 3 dia(s)' }))

        expect(await screen.findByRole('status')).toHaveTextContent('3 dia(s) avançado(s), até o dia simulado 15.')
        expect(advanceTicks).toHaveBeenCalledWith('token', 3)
    })

    it('avançar com falha no meio informa quantos dias já rodaram', async () => {
        vi.mocked(advanceTicks).mockRejectedValue(new ApiError(500, 'falha', { completed_ticks: [{ day: 7 }, { day: 8 }] }))
        renderPage()
        await screen.findByText('Ativa')
        fireEvent.click(screen.getByRole('button', { name: 'Avançar' }))
        fireEvent.click(screen.getByRole('button', { name: 'Avançar 5 dia(s)' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('Falhou no meio: 2 dia(s) já rodaram')
    })

    it('tick em andamento (vindo do motor) trava as ações', async () => {
        vi.mocked(getScheduler).mockResolvedValue({ ...status, tick_in_progress: true })
        renderPage()
        expect(await screen.findByText('Tick em andamento')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Disparar 1 tick' })).toBeDisabled()
    })

    it('erro ao carregar o estado e o histórico mostra alertas', async () => {
        vi.mocked(getScheduler).mockRejectedValue(new Error('falhou'))
        vi.mocked(listTicks).mockRejectedValue(new Error('falhou'))
        renderPage()
        expect(await screen.findByText('Não foi possível ler o estado do temporizador agora.')).toBeInTheDocument()
        expect(await screen.findByText('Não foi possível carregar o histórico agora. Tente novamente em instantes.')).toBeInTheDocument()
    })
})
