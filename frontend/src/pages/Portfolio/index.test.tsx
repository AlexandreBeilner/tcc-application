import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getMyAccount } from '../../services/market'
import type { MyAccount } from '../../services/market'
import { getProgression, getStreak } from '../../services/gamification'
import { listLessons } from '../../services/lessons'
import type { Lesson } from '../../services/lessons'
import { listMissions } from '../../services/missions'
import { Portfolio } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/market', () => ({ getMyAccount: vi.fn() }))
vi.mock('../../services/gamification', () => ({ getProgression: vi.fn(), getStreak: vi.fn() }))
vi.mock('../../services/lessons', () => ({ listLessons: vi.fn() }))
vi.mock('../../services/missions', () => ({ listMissions: vi.fn(), completeMission: vi.fn() }))

function LocationProbe() {
    const location = useLocation()
    return <div>tela de ativos {location.pathname + location.search}</div>
}

function renderPortfolio() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/', element: <Portfolio /> },
            { path: '/trilha', element: <div>tela de trilha</div> },
            { path: '/trilha/:id', element: <div>tela de lição</div> },
            { path: '/mercado', element: <div>tela de mercado</div> },
            { path: '/conquistas', element: <div>tela de conquistas</div> },
            { path: '/extrato', element: <div>tela de extrato</div> },
            { path: '/ativos', element: <LocationProbe /> },
            { path: '/noticias', element: <div>tela de notícias</div> },
        ],
        { initialEntries: ['/'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const emptyAccount: MyAccount = {
    cashBalance: 10000,
    totalInvested: 0,
    totalDividendsReceived: 0,
    positions: [],
    fixedIncomePositions: [],
}

const progression = {
    userId: '1',
    xp: 100,
    level: 2,
    currentStreak: 3,
    longestStreak: 5,
    lastQualifyingActivityDate: null,
    monthlySalary: 200,
}

const streak = { currentStreak: 3, longestStreak: 5 }

const availableLesson: Lesson = {
    id: 'lesson-1',
    code: '1.2',
    title: 'Reserva de emergência',
    trackNumber: 1,
    trackName: 'Fundamentos',
    sortOrder: 2,
    centralConcept: 'liquidez',
    scenarioText: '',
    microDecisionPrompt: '',
    microDecisionType: 'reflection',
    microDecisionAssetTicker: null,
    revelationText: '',
    unlocksDescription: 'Tesouro Selic',
    unlocksKeys: [],
    unlocksAssetTicker: null,
    microDecisionOptions: null,
    status: 'available',
    currentStep: 0,
}

describe('Portfolio (tela 2.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token-valido',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listMissions).mockResolvedValue({ missions: [] })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('estado vazio: sem posições oferece a Trilha, e o Investir fica no card', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        await waitFor(() => expect(screen.getByText('Você ainda não tem nenhuma posição')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Ir pra Trilha' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Ir pro Mercado' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Investir' })).toBeInTheDocument()
    })

    it('com posições mostra os cards de patrimônio e o gráfico de distribuição, sem estado vazio', async () => {
        vi.mocked(getMyAccount).mockResolvedValue({
            ...emptyAccount,
            positions: [
                {
                    assetId: 'a1',
                    ticker: 'PETR4',
                    name: 'Petrobras',
                    type: 'acao',
                    isSandbox: false,
                    quantity: 10,
                    averagePrice: 30,
                    dividendsReceived: 0,
                },
            ],
            fixedIncomePositions: [],
        })
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        await waitFor(() => expect(screen.getByText('Mercado Ao Vivo')).toBeInTheDocument())
        expect(screen.queryByRole('button', { name: 'Ver meus ativos do modo aprendizado' })).not.toBeInTheDocument()
        expect(screen.getByText('Ações')).toBeInTheDocument()
        expect(screen.queryByText('Você ainda não tem nenhuma posição')).not.toBeInTheDocument()
    })

    it('mostra XP/nível e streak a partir das duas queries de gamificação', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        await waitFor(() => expect(screen.getByText('Nível 2')).toBeInTheDocument())
        expect(screen.getByText('100 XP')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByText('dias seguidos')).toBeInTheDocument()
    })

    it('mostra "faltam N lições" pro próximo desbloqueio, considerando lições concluídas', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [{ ...availableLesson, id: '0', sortOrder: 1, status: 'completed', unlocksDescription: '' }, availableLesson],
        })

        renderPortfolio()

        expect(await screen.findByText(/Faltam 1 lição pra:/)).toBeInTheDocument()
        expect(screen.getByText('Tesouro Selic')).toBeInTheDocument()
    })

    it('atalho "Retomar lição" aparece pra primeira lição disponível e navega direto pra ela', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [availableLesson] })

        renderPortfolio()

        await waitFor(() => expect(screen.getByText('Reserva de emergência')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Reserva de emergência'))
        await waitFor(() => expect(screen.getByText('tela de lição')).toBeInTheDocument())
    })

    it('sem lição disponível não mostra o atalho de retomar', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [{ ...availableLesson, status: 'locked' }],
        })

        renderPortfolio()

        await waitFor(() => expect(getMyAccount).toHaveBeenCalled())
        expect(screen.queryByText('Reserva de emergência')).not.toBeInTheDocument()
    })

    it('"Investir" fica uma vez só, no card de patrimônio, e leva ao Mercado; "Conquistas" saiu da tela', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        await waitFor(() => expect(screen.getAllByRole('button', { name: 'Investir' })).toHaveLength(1))
        expect(screen.queryByRole('button', { name: 'Conquistas' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Investir' }))
        await waitFor(() => expect(screen.getByText('tela de mercado')).toBeInTheDocument())
    })

    it('clique no card de patrimônio leva pra Meus ativos', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        await waitFor(() => expect(screen.getByRole('button', { name: 'Ver meus ativos do mercado ao vivo' })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Ver meus ativos do mercado ao vivo' }))
        await waitFor(() => expect(screen.getByText('tela de ativos /ativos')).toBeInTheDocument())
    })

    it('clicar numa categoria da rosca abre Meus ativos já filtrado', async () => {
        vi.mocked(getMyAccount).mockResolvedValue({
            ...emptyAccount,
            positions: [
                {
                    assetId: 'a1',
                    ticker: 'PETR4',
                    name: 'Petrobras',
                    type: 'acao',
                    isSandbox: false,
                    quantity: 10,
                    averagePrice: 30,
                    dividendsReceived: 0,
                },
            ],
        })
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        fireEvent.click(await screen.findByRole('button', { name: /^Ações:/ }))
        await waitFor(() => expect(screen.getByText('tela de ativos /ativos?categoria=acoes')).toBeInTheDocument())
    })

    it('mostra as missões do dia e navega pra tela que cumpre a missão clicada', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })
        vi.mocked(listMissions).mockResolvedValue({
            missions: [
                {
                    id: 'm1',
                    key: 'feed_read',
                    title: 'Consulte o feed de notícias',
                    description: 'Leia pelo menos um evento no feed hoje.',
                    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase.',
                    xpReward: 10,
                    requiresLessonCompletion: false,
                    status: 'pending',
                },
            ],
        })

        renderPortfolio()

        await waitFor(() => expect(screen.getByText('Consulte o feed de notícias')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: /Consulte o feed de notícias/ }))
        await waitFor(() => expect(screen.getByText('tela de notícias')).toBeInTheDocument())
    })

    it('sem missões do dia não mostra a seção "Missões do dia"', async () => {
        vi.mocked(getMyAccount).mockResolvedValue(emptyAccount)
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        await waitFor(() => expect(screen.getByRole('button', { name: 'Investir' })).toBeInTheDocument())
        expect(screen.queryByText('Missões do dia')).not.toBeInTheDocument()
    })

    it('erro ao carregar a conta mostra mensagem, sem quebrar a tela', async () => {
        vi.mocked(getMyAccount).mockRejectedValue(new Error('falha de rede'))
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        await waitFor(() =>
            expect(screen.getByText('Não foi possível carregar sua conta agora. Tente novamente em instantes.')).toBeInTheDocument(),
        )
    })

    it('enquanto a conta carrega mostra placeholder em vez de texto solto', () => {
        vi.mocked(getMyAccount).mockReturnValue(new Promise(() => {}))
        vi.mocked(getProgression).mockResolvedValue(progression)
        vi.mocked(getStreak).mockResolvedValue(streak)
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderPortfolio()

        expect(screen.getByRole('status', { name: 'Carregando conta' })).toBeInTheDocument()
    })
})
