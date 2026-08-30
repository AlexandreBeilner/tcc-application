import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listNews } from '../../services/news'
import { listAssets } from '../../services/market'
import { completeMission, listMissions } from '../../services/missions'
import { News } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/news', () => ({ listNews: vi.fn() }))
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
    title: 'Consulte o feed de notícias',
    description: 'Abra o feed de notícias de mercado e leia pelo menos um evento.',
    completionCriteria: 'Reportado pelo cliente — sem verificação cruzada nesta fase',
    xpReward: 30,
    requiresLessonCompletion: false,
    status: 'pending' as const,
}

describe('News (tela 5.1)', () => {
    beforeEach(() => {
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
                },
            ],
        })

        renderPage()
        expect(await screen.findByText('Alta de juros afeta bancos')).toBeInTheDocument()
    })

    it('estado vazio sem eventos disparados', async () => {
        vi.mocked(listNews).mockResolvedValue({ events: [] })
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
                },
            ],
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
                },
            ],
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
                },
            ],
        })

        renderPage()
        fireEvent.click(await screen.findByText('Evento qualquer'))

        await waitFor(() => expect(listMissions).toHaveBeenCalled())
        expect(completeMission).not.toHaveBeenCalled()
    })
})
