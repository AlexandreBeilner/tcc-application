import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getDailyMetrics, getDailyOverview, prepareDailyDraft, publishDailyPuzzles, setDailyStartDate } from '../../services/admin'
import type { DailyAgendaDay, DailyOverview, DailyTally } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminDiario } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../features/admin/AdminReauth', async () => {
    class ReauthCancelledError extends Error {}
    return { ReauthCancelledError, useAdminReauth: () => ({ withReauth: (run: (token: string) => Promise<unknown>) => run('tok') }) }
})
vi.mock('../../services/admin', () => ({
    getDailyOverview: vi.fn(),
    getDailyMetrics: vi.fn(),
    prepareDailyDraft: vi.fn(),
    setDailyStartDate: vi.fn(),
    publishDailyPuzzles: vi.fn(),
}))

const tally = (total: number): DailyTally => ({ total, brasil: total - 1, fora: 1, by_category: { instituicoes: total } })

const day = (number: number, over: Partial<DailyAgendaDay> = {}): DailyAgendaDay => ({
    number,
    date: `2026-11-${String(9 + number).padStart(2, '0')}`,
    published: false,
    origins: { word: 'generated', question: 'generated', timeline: 'generated' },
    word: { display: 'SELIC', category: 'juros-e-inflacao', scope: 'brasil' },
    question: { text: 'Quem fixa a meta de inflação?', category: 'instituicoes', scope: 'brasil' },
    events: [{ label: 'Plano Real', year: 1994, category: 'planos-e-moeda', scope: 'brasil' }],
    ...over,
})

const overview = (over: Partial<DailyOverview> = {}): DailyOverview => ({
    status: 'off',
    start_date: null,
    today: '2026-10-20',
    can_change_start: true,
    agenda_from: '2026-11-10',
    ready_days_ahead: 0,
    published_days_ahead: 0,
    min_days_to_schedule: 30,
    low_cover_threshold: 14,
    alerts: [],
    days: [],
    coverage: { window_days: 30, word: tally(0), trivia: tally(0), timeline: tally(0) },
    bank: { words: 60, questions: 60, events: 200, accepted_extra: 1 },
    ...over,
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter>
                <AdminDiario />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyMetrics).mockResolvedValue({ days: [] })
})

describe('AdminDiario', () => {
    it('desligado e sem jogos: explica o primeiro passo', async () => {
        vi.mocked(getDailyOverview).mockResolvedValue(overview())
        renderPage()

        expect(await screen.findByText('Desligado')).toBeInTheDocument()
        expect(screen.getByText(/Nenhum jogo na agenda/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Agendar estreia' })).toBeDisabled()
    })

    it('mostra a agenda com o estado de cada dia e os alertas', async () => {
        vi.mocked(getDailyOverview).mockResolvedValue(
            overview({
                status: 'scheduled',
                start_date: '2026-11-10',
                alerts: ['low_ready_cover'],
                ready_days_ahead: 1,
                days: [day(1, { published: true }), day(2, { origins: { word: 'manual', question: 'generated', timeline: 'generated' } })],
                coverage: { window_days: 30, word: tally(2), trivia: tally(2), timeline: tally(8) },
            }),
        )
        renderPage()

        expect(await screen.findByText('Estreia agendada')).toBeInTheDocument()
        expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Menos de 14 dias prontos')
        expect(screen.getAllByText('Publicado').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Trocado à mão').length).toBeGreaterThan(0)
        expect(screen.getByRole('button', { name: 'Publicar pendentes (1)' })).toBeEnabled()
        expect(screen.getAllByRole('link', { name: 'Abrir' })[0]).toHaveAttribute('href', '/admin/diario/jogo/1')
    })

    it('prepara o rascunho da data informada', async () => {
        vi.mocked(getDailyOverview).mockResolvedValue(overview())
        vi.mocked(prepareDailyDraft).mockResolvedValue({ start_date: '2026-11-10', created: 30, warnings: [] })
        renderPage()

        fireEvent.change(await screen.findByLabelText('Data de estreia'), { target: { value: '2026-11-10' } })
        fireEvent.click(screen.getByRole('button', { name: 'Preparar rascunho' }))

        expect(await screen.findByRole('status')).toHaveTextContent('Rascunho pronto a partir de 10/11/2026: 30 jogo(s) novo(s).')
        expect(prepareDailyDraft).toHaveBeenCalledWith('tok', '2026-11-10')
    })

    it('agendar confirma antes e mostra a recusa de conteúdo insuficiente', async () => {
        vi.mocked(getDailyOverview).mockResolvedValue(overview())
        vi.mocked(setDailyStartDate).mockRejectedValue(
            new ApiError(409, 'a estreia exige 30 dias seguidos de jogos prontos a partir da data', {
                error: 'x',
                code: 'insufficient_content',
            }),
        )
        renderPage()

        fireEvent.change(await screen.findByLabelText('Data de estreia'), { target: { value: '2026-11-10' } })
        fireEvent.click(screen.getByRole('button', { name: 'Agendar estreia' }))
        expect(screen.getByText('Agendar a estreia?')).toBeInTheDocument()
        expect(setDailyStartDate).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Agendar' }))
        expect(await screen.findByText(/a estreia exige 30 dias seguidos/)).toBeInTheDocument()
        expect(setDailyStartDate).toHaveBeenCalledWith('tok', '2026-11-10')
    })

    it('no ar: a data não muda mais e não há controles', async () => {
        vi.mocked(getDailyOverview).mockResolvedValue(
            overview({ status: 'live', start_date: '2026-10-01', can_change_start: false, alerts: ['today_not_published'] }),
        )
        renderPage()

        expect(await screen.findByText(/A data de estreia não muda mais/)).toBeInTheDocument()
        expect(screen.queryByLabelText('Data de estreia')).not.toBeInTheDocument()
        expect(screen.getAllByRole('alert')[0]).toHaveTextContent('O jogo de hoje não está publicado')
    })

    it('publica em lote os dias pendentes', async () => {
        vi.mocked(getDailyOverview).mockResolvedValue(
            overview({
                status: 'live',
                start_date: '2026-10-01',
                can_change_start: false,
                days: [day(1), day(2)],
            }),
        )
        vi.mocked(publishDailyPuzzles).mockResolvedValue({ published: [1, 2] })
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Publicar pendentes (2)' }))

        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Publicados: #1, #2.'))
        expect(publishDailyPuzzles).toHaveBeenCalledWith('tok', undefined)
    })
})
