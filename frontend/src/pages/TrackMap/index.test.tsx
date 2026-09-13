import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listLessons } from '../../services/lessons'
import type { Lesson } from '../../services/lessons'
import { TrackMap } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/lessons', async () => {
    const actual = await vi.importActual<typeof import('../../services/lessons')>('../../services/lessons')
    return { ...actual, listLessons: vi.fn() }
})

function renderTrackMap(initialPath: string) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/trilha', element: <div>tela do hub de trilhas</div> },
            { path: '/trilha/mapa/:trackNumber', element: <TrackMap /> },
            { path: '/trilha/:id', element: <div>tela de lição</div> },
        ],
        { initialEntries: [initialPath] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: 'lesson-1',
        code: '0.1',
        title: 'O que é investir',
        trackNumber: 0,
        trackName: 'Fundamentos',
        sortOrder: 1,
        centralConcept: '',
        scenarioText: '',
        microDecisionPrompt: '',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: null,
        revelationText: '',
        unlocksDescription: '',
        unlocksKeys: [],
        unlocksAssetTicker: null,
        microDecisionOptions: null,
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

describe('TrackMap (tela nova, backlog engajamento O.3)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token-valido',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('trackNumber fora do currículo redireciona pro Hub', async () => {
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderTrackMap('/trilha/mapa/99')

        expect(await screen.findByText('tela do hub de trilhas')).toBeInTheDocument()
    })

    it('trackNumber não numérico redireciona pro Hub', async () => {
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })

        renderTrackMap('/trilha/mapa/abc')

        expect(await screen.findByText('tela do hub de trilhas')).toBeInTheDocument()
    })

    it('mostra o cabeçalho tipo cotação com ticker/nome/percentual da trilha certa', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: '1', trackNumber: 1, trackName: 'Renda Fixa', status: 'completed' }),
                lesson({ id: '2', trackNumber: 1, trackName: 'Renda Fixa', status: 'available' }),
                lesson({ id: '3', trackNumber: 0, trackName: 'Fundamentos', status: 'completed' }),
            ],
        })

        renderTrackMap('/trilha/mapa/1')

        expect(await screen.findByText('50%')).toBeInTheDocument()
        expect(screen.getByText('TRLH1')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Renda Fixa' })).toBeInTheDocument()
        expect(screen.getByText('1/2 concluídas')).toBeInTheDocument()
    })

    it('clicar num nó available/completed navega pra Lição', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: '1', title: 'Primeira', status: 'completed' }),
                lesson({ id: '2', title: 'Segunda', status: 'available' }),
            ],
        })

        renderTrackMap('/trilha/mapa/0')

        const node = await screen.findByRole('button', { name: /Segunda: Disponível/ })
        fireEvent.click(node)

        expect(await screen.findByText('tela de lição')).toBeInTheDocument()
    })

    it('clicar num nó bloqueado expande o aviso inline, sem navegar', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', title: 'Primeira', status: 'available' }), lesson({ id: '2', title: 'Segunda', status: 'locked' })],
        })

        renderTrackMap('/trilha/mapa/0')

        const node = await screen.findByRole('button', { name: /Segunda: Bloqueada/ })
        fireEvent.click(node)

        expect(screen.getByText('Conclua a lição anterior pra desbloquear.')).toBeInTheDocument()
        expect(screen.queryByText('tela de lição')).not.toBeInTheDocument()
    })

    it('legenda fica escondida atrás do ícone no cabeçalho, não numa sidebar sempre visível (achado P.2)', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', title: 'Primeira', status: 'available' }), lesson({ id: '2', title: 'Segunda', status: 'locked' })],
        })

        renderTrackMap('/trilha/mapa/0')

        const trigger = await screen.findByRole('button', { name: 'Como ler o mapa' })
        expect(screen.queryByText('Já concluído (sólido)')).not.toBeInTheDocument()

        fireEvent.click(trigger)

        expect(screen.getByText('Já concluído (sólido)')).toBeInTheDocument()
    })

    it('trilha com 1 única lição cai no fallback de nó único, em vez de tela em branco', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', trackNumber: 1, trackName: 'Renda Fixa', title: 'Teaser', status: 'available' })],
        })

        renderTrackMap('/trilha/mapa/1')

        const node = await screen.findByRole('button', { name: /Teaser: Disponível/ })
        fireEvent.click(node)

        expect(await screen.findByText('tela de lição')).toBeInTheDocument()
    })

    it('trilha com 1 única lição bloqueada expande o aviso inline no fallback, sem navegar', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', trackNumber: 1, trackName: 'Renda Fixa', title: 'Teaser', status: 'locked' })],
        })

        renderTrackMap('/trilha/mapa/1')

        const node = await screen.findByRole('button', { name: /Teaser: Bloqueada/ })
        fireEvent.click(node)

        expect(screen.getByText('Conclua a lição anterior pra desbloquear.')).toBeInTheDocument()
        expect(screen.queryByText('tela de lição')).not.toBeInTheDocument()
    })

    it('trilha 100% bloqueada ainda renderiza o mapa inteiro (bloqueio é convite)', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', title: 'Primeira', status: 'locked' }), lesson({ id: '2', title: 'Segunda', status: 'locked' })],
        })

        renderTrackMap('/trilha/mapa/0')

        expect(await screen.findByRole('button', { name: 'Primeira: Bloqueada' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Segunda: Bloqueada' })).toBeInTheDocument()
        expect(screen.queryByText('tela do hub de trilhas')).not.toBeInTheDocument()
    })
})
