import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { useUnlockedKeys } from '../../features/lessons/useUnlockedKeys'
import { listNews, markNewsEventSeen } from '../../services/news'
import { listAssets } from '../../services/market'
import { completeMission, listMissions } from '../../services/missions'
import { News } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../features/lessons/useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))
vi.mock('../../services/news', () => ({ listNews: vi.fn(), markNewsEventSeen: vi.fn() }))
vi.mock('../../services/market', () => ({ listAssets: vi.fn() }))
vi.mock('../../services/missions', () => ({ listMissions: vi.fn(), completeMission: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <News />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

const feedMission = {
    id: 'mission-feed',
    key: 'feed_read',
    title: 'Consulte o feed de notícias',
    description: 'Abra o feed de notícias de mercado e leia pelo menos um evento.',
    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase',
    xpReward: 30,
    requiresLessonCompletion: false,
    status: 'pending' as const,
}

describe('News (tela 5.1)', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listAssets).mockResolvedValue({ assets: [] })
        vi.mocked(listMissions).mockResolvedValue({ missions: [feedMission] })
        vi.mocked(completeMission).mockResolvedValue({ status: 'completed' })
        vi.mocked(markNewsEventSeen).mockResolvedValue(undefined)
        // Desbloqueado por padrão — os testes deste arquivo não são sobre o
        // aviso de gate da tarefa 7.0.1 (ver describe dedicado abaixo).
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(['news_feed']), lessons: [], isLoading: false })
    })

    afterEach(() => vi.clearAllMocks())

    it('lista os eventos do feed', async () => {
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Alta de juros afeta bancos',
                    narrative: 'narrativa',
                    direction: 'negativo',
                    magnitude_band: 'moderado',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 5,
                    duration_days: 2,
                    targets: [{ sector: 'Financeiro' }],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })

        renderPage()
        expect(await screen.findByText('Alta de juros afeta bancos')).toBeInTheDocument()
    })

    it('busca a primeira página com o tamanho default de paginação', async () => {
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })
        renderPage()
        await waitFor(() => expect(listNews).toHaveBeenCalledWith('token', 20, 0))
    })

    it('pagina o feed (6.9.9) e recalcula o offset ao trocar de página', async () => {
        const page1 = Array.from({ length: 20 }, (_, i) => ({
            id: `p1-${i}`,
            title: `Evento ${i}`,
            narrative: 'narrativa',
            direction: 'misto' as const,
            magnitude_band: 'leve' as const,
            affects_price: true,
            affects_fundamentals: false,
            status: 'pendente' as const,
            triggered_on_day: 1,
            duration_days: 1,
            targets: [],
            created_at: '2026-08-30T14:05:00.000Z',
            seen: false,
        }))
        const page2 = [
            {
                id: 'p2-0',
                title: 'Evento da segunda página',
                narrative: 'narrativa',
                direction: 'misto' as const,
                magnitude_band: 'leve' as const,
                affects_price: true,
                affects_fundamentals: false,
                status: 'pendente' as const,
                triggered_on_day: 2,
                duration_days: 1,
                targets: [],
                created_at: '2026-08-30T14:05:00.000Z',
                seen: false,
            },
        ]
        vi.mocked(listNews).mockImplementation((_token: string, _limit?: number, offset?: number) =>
            Promise.resolve({ events: offset === 0 || offset === undefined ? page1 : page2, total_entries: 21 }),
        )

        renderPage()
        expect(await screen.findByRole('navigation', { name: 'Paginação do feed de notícias' })).toBeInTheDocument()
        expect(screen.queryByText('Evento da segunda página')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))

        await waitFor(() => expect(listNews).toHaveBeenCalledWith('token', 20, 20))
        expect(await screen.findByText('Evento da segunda página')).toBeInTheDocument()
    })

    it('não move o marcador de "visto" pra trás ao navegar pra uma página mais antiga (achado de revisão da 6.9.9)', async () => {
        const page1 = Array.from({ length: 20 }, (_, i) => ({
            id: `p1-${i}`,
            title: `Evento ${i}`,
            narrative: 'narrativa',
            direction: 'misto' as const,
            magnitude_band: 'leve' as const,
            affects_price: true,
            affects_fundamentals: false,
            status: 'pendente' as const,
            triggered_on_day: 1,
            duration_days: 1,
            targets: [],
            created_at: '2026-08-30T14:05:00.000Z',
            seen: false,
        }))
        const page2 = [
            {
                id: 'p2-0',
                title: 'Evento da segunda página',
                narrative: 'narrativa',
                direction: 'misto' as const,
                magnitude_band: 'leve' as const,
                affects_price: true,
                affects_fundamentals: false,
                status: 'pendente' as const,
                triggered_on_day: 2,
                duration_days: 1,
                targets: [],
                created_at: '2026-08-30T14:05:00.000Z',
                seen: false,
            },
        ]
        vi.mocked(listNews).mockImplementation((_token: string, _limit?: number, offset?: number) =>
            Promise.resolve({ events: offset === 0 || offset === undefined ? page1 : page2, total_entries: 21 }),
        )

        renderPage()
        await screen.findByText('Evento 0')
        expect(localStorage.getItem('tcc.news.lastSeenId')).toBe('p1-0')

        fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
        await screen.findByText('Evento da segunda página')

        // `p1-0` continua sendo o marcador — se a página 2 (mais antiga)
        // sobrescrevesse pra `p2-0`, eventos pendentes entre os dois
        // voltariam a contar como não vistos.
        expect(localStorage.getItem('tcc.news.lastSeenId')).toBe('p1-0')
    })

    it('estado vazio sem eventos disparados', async () => {
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })
        renderPage()
        expect(await screen.findByText('Nenhum evento de mercado disparado ainda.')).toBeInTheDocument()
    })

    it('resolve asset_id do target via GET /market/assets, "TICKER · Nome"', async () => {
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Resultado trimestral do banco',
                    narrative: 'narrativa',
                    direction: 'positivo',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'aplicado',
                    triggered_on_day: 5,
                    duration_days: 1,
                    targets: [{ asset_id: 'a1' }],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })
        vi.mocked(listAssets).mockResolvedValue({
            assets: [{ id: 'a1', ticker: 'BNDD4', name: 'Banco D S.A.', type: 'acao', is_sandbox: false }],
        })

        renderPage()
        fireEvent.click(await screen.findByText('Resultado trimestral do banco'))
        expect(await screen.findByText('BNDD4 · Banco D S.A.')).toBeInTheDocument()
    })

    it('ler um evento reporta a missão "Consulte o feed de notícias"', async () => {
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Evento qualquer',
                    narrative: 'narrativa',
                    direction: 'misto',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 1,
                    duration_days: 1,
                    targets: [],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })

        renderPage()
        fireEvent.click(await screen.findByText('Evento qualquer'))

        await waitFor(() => expect(completeMission).toHaveBeenCalledWith('token', 'mission-feed'))
    })

    it('não reporta a missão de novo se ela já está concluída', async () => {
        vi.mocked(listMissions).mockResolvedValue({ missions: [{ ...feedMission, status: 'completed' }] })
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Evento qualquer',
                    narrative: 'narrativa',
                    direction: 'misto',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 1,
                    duration_days: 1,
                    targets: [],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })

        renderPage()
        fireEvent.click(await screen.findByText('Evento qualquer'))

        await waitFor(() => expect(listMissions).toHaveBeenCalled())
        expect(completeMission).not.toHaveBeenCalled()
    })

    it('ao expandir um evento ainda não visto, chama POST /news/:id/seen', async () => {
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Evento não visto',
                    narrative: 'narrativa',
                    direction: 'misto',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 1,
                    duration_days: 1,
                    targets: [],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })

        renderPage()
        fireEvent.click(await screen.findByText('Evento não visto'))

        await waitFor(() => expect(markNewsEventSeen).toHaveBeenCalledWith('token', 'e1'))
    })

    it('reporta a missão mesmo quando GET /missions ainda não respondeu na primeira leitura', async () => {
        let resolveMissions!: (value: Awaited<ReturnType<typeof listMissions>>) => void
        vi.mocked(listMissions).mockReturnValue(
            new Promise((resolve) => {
                resolveMissions = resolve
            }),
        )
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Evento antes das missões carregarem',
                    narrative: 'narrativa',
                    direction: 'misto',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 1,
                    duration_days: 1,
                    targets: [],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })

        renderPage()
        fireEvent.click(await screen.findByText('Evento antes das missões carregarem'))
        expect(completeMission).not.toHaveBeenCalled()

        resolveMissions({ missions: [feedMission] })

        await waitFor(() => expect(completeMission).toHaveBeenCalledWith('token', 'mission-feed'))
    })

    it('marcar um evento como visto não recarrega o feed inteiro (patch local do cache)', async () => {
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Evento não visto',
                    narrative: 'narrativa',
                    direction: 'misto',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 1,
                    duration_days: 1,
                    targets: [],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: false,
                },
            ],
            total_entries: 1,
        })

        renderPage()
        fireEvent.click(await screen.findByText('Evento não visto'))

        await waitFor(() => expect(markNewsEventSeen).toHaveBeenCalledWith('token', 'e1'))
        expect(listNews).toHaveBeenCalledTimes(1)
    })

    it('não chama POST /news/:id/seen pra evento já visto', async () => {
        vi.mocked(listNews).mockResolvedValue({
            events: [
                {
                    id: 'e1',
                    title: 'Evento já visto',
                    narrative: 'narrativa',
                    direction: 'misto',
                    magnitude_band: 'leve',
                    affects_price: true,
                    affects_fundamentals: false,
                    status: 'pendente',
                    triggered_on_day: 1,
                    duration_days: 1,
                    targets: [],
                    created_at: '2026-08-30T14:05:00.000Z',
                    seen: true,
                },
            ],
            total_entries: 1,
        })

        renderPage()
        fireEvent.click(await screen.findByText('Evento já visto'))

        await waitFor(() => expect(listMissions).toHaveBeenCalled())
        expect(markNewsEventSeen).not.toHaveBeenCalled()
    })

    it('avisa (sem bloquear) quando news_feed ainda não foi desbloqueado (tarefa 7.0.1)', async () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(),
            lessons: [
                {
                    id: 'lesson-2-4',
                    code: '2.4',
                    title: 'Lendo notícias de mercado',
                    trackNumber: 2,
                    trackName: 'Renda Variável',
                    sortOrder: 11,
                    centralConcept: 'x',
                    unlocksDescription: '',
                    unlocksKeys: ['news_feed'],
                    status: 'available',
                    currentStep: 0,
                },
            ],
            isLoading: false,
        })
        vi.mocked(listNews).mockResolvedValue({ events: [], total_entries: 0 })

        renderPage()

        expect(await screen.findByText(/Desbloqueia de verdade na lição 2.4/)).toBeInTheDocument()
        // Feed continua acessível mesmo travado — não é bloqueio rígido.
        await waitFor(() => expect(listNews).toHaveBeenCalled())
    })
})
