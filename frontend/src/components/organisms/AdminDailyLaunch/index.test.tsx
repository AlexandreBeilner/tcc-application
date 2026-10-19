import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { setDailyStartDate } from '../../../services/admin'
import type { DailyOverview } from '../../../services/admin'
import { AdminDailyLaunch } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../features/admin/AdminReauth', () => ({
    ReauthCancelledError: class extends Error {},
    useAdminReauth: () => ({ withReauth: (run: (token: string) => Promise<unknown>) => run('tok') }),
}))
vi.mock('../../../services/admin', () => ({ prepareDailyDraft: vi.fn(), setDailyStartDate: vi.fn() }))

const scheduled: DailyOverview = {
    status: 'scheduled',
    start_date: '2026-11-10',
    today: '2026-10-20',
    can_change_start: true,
    agenda_from: '2026-11-10',
    ready_days_ahead: 30,
    published_days_ahead: 30,
    min_days_to_schedule: 30,
    low_cover_threshold: 14,
    alerts: [],
    days: [],
    coverage: {
        window_days: 30,
        word: { total: 0, brasil: 0, fora: 0, by_category: {} },
        trivia: { total: 0, brasil: 0, fora: 0, by_category: {} },
        timeline: { total: 0, brasil: 0, fora: 0, by_category: {} },
    },
    bank: { words: 1, questions: 1, events: 1, accepted_extra: 0 },
}

function renderLaunch(overview: DailyOverview) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <AdminDailyLaunch overview={overview} />
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
})

describe('AdminDailyLaunch', () => {
    it('agendado: mostra a data e os dias prontos contra o mínimo', () => {
        renderLaunch(scheduled)

        expect(screen.getByText('Estreia em 10/11/2026. Até lá nenhuma rota de jogo responde.')).toBeInTheDocument()
        expect(screen.getByText('de 30 necessários')).toBeInTheDocument()
        expect(screen.getByLabelText('Data de estreia')).toHaveValue('2026-11-10')
    })

    it('desliga só depois de confirmar', async () => {
        vi.mocked(setDailyStartDate).mockResolvedValue({ start_date: null, status: 'off', published: [] })
        renderLaunch(scheduled)

        fireEvent.click(screen.getByRole('button', { name: 'Desligar' }))
        expect(setDailyStartDate).not.toHaveBeenCalled()
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desligar' }))

        await waitFor(() => expect(setDailyStartDate).toHaveBeenCalledWith('tok', null))
        expect(await screen.findByRole('status')).toHaveTextContent('Diário desligado.')
    })

    it('no ar não oferece nenhum controle de data', () => {
        renderLaunch({ ...scheduled, status: 'live', can_change_start: false })

        expect(screen.queryByLabelText('Data de estreia')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Desligar' })).not.toBeInTheDocument()
        expect(screen.getByText('No ar')).toBeInTheDocument()
    })
})
