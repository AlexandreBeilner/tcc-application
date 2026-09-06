import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listLessons } from '../../services/lessons'
import type { Lesson } from '../../services/lessons'
import { getProgression, getStreak } from '../../services/gamification'
import { Track } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/lessons', () => ({ listLessons: vi.fn() }))
vi.mock('../../services/gamification', () => ({ getProgression: vi.fn(), getStreak: vi.fn() }))

function renderTrilha() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/trilha', element: <Track /> },
            { path: '/trilha/:id', element: <div>tela de lição</div> },
        ],
        { initialEntries: ['/trilha'] },
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
        centralConcept: 'Investir é postergar consumo',
        scenarioText: '',
        microDecisionPrompt: '',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: null,
        revelationText: '',
        unlocksDescription: '',
        unlocksKeys: [],
        unlocksAssetTicker: null,
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

describe('Track (tela 3.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token-valido',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getProgression).mockResolvedValue({
            userId: '1',
            xp: 100,
            level: 2,
            currentStreak: 1,
            longestStreak: 1,
            lastQualifyingActivityDate: null,
        })
        vi.mocked(getStreak).mockResolvedValue({ currentStreak: 1, longestStreak: 1 })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('mostra o progresso geral e agrupa lições por trilha', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: '1', status: 'completed' }),
                lesson({ id: '2', trackNumber: 1, trackName: 'Renda Fixa', status: 'available' }),
            ],
        })

        renderTrilha()

        await waitFor(() => expect(screen.getByText('1 de 2 lições concluídas')).toBeInTheDocument())
        expect(screen.getByText('Fundamentos')).toBeInTheDocument()
        // "Renda Fixa" aparece 2x: no cabeçalho da trilha e no ResumeLessonCard
        // da barra lateral (mesma lição `available`, dois lugares diferentes).
        expect(screen.getAllByText('Renda Fixa').length).toBeGreaterThan(0)
    })

    it('clique numa lição disponível navega pra /trilha/:id', async () => {
        vi.mocked(listLessons).mockResolvedValue({ lessons: [lesson({ id: 'lesson-2', status: 'available' })] })

        renderTrilha()

        await waitFor(() => expect(screen.getByRole('button', { name: /Disponível/ })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: /Disponível/ }))
        await waitFor(() => expect(screen.getByText('tela de lição')).toBeInTheDocument())
    })

    it('clique numa lição bloqueada mostra dica, sem navegar', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ status: 'locked', unlocksDescription: 'Tesouro Selic' })],
        })

        renderTrilha()

        const node = await screen.findByRole('button', { name: /Bloqueada: libera Tesouro Selic/ })
        fireEvent.click(node)
        expect(await screen.findByText('Conclua a lição anterior pra desbloquear.')).toBeInTheDocument()
        expect(screen.queryByText('tela de lição')).not.toBeInTheDocument()
    })

    it('todas as lições concluídas mostra o banner de mundo aberto liberado', async () => {
        vi.mocked(listLessons).mockResolvedValue({ lessons: [lesson({ status: 'completed' })] })

        renderTrilha()

        expect(await screen.findByText('Mundo aberto liberado.')).toBeInTheDocument()
    })

    it('erro ao carregar a trilha mostra mensagem', async () => {
        vi.mocked(listLessons).mockRejectedValue(new Error('falha de rede'))

        renderTrilha()

        expect(await screen.findByText('Não foi possível carregar a trilha agora. Tente novamente em instantes.')).toBeInTheDocument()
    })

    it('trilha com 2+ lições vira gráfico (TrackChart), não lista simples', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: '1', title: 'O que é investir', status: 'completed' }),
                lesson({ id: '2', title: 'Juros compostos', status: 'available' }),
                lesson({ id: '3', title: 'Inflação', status: 'locked', unlocksDescription: 'Renda Fixa' }),
            ],
        })

        renderTrilha()

        expect(await screen.findByRole('button', { name: 'Juros compostos: Disponível' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Juros compostos: Disponível' }))
        await waitFor(() => expect(screen.getByText('tela de lição')).toBeInTheDocument())
    })

    it('trilha com 2+ lições: clique numa bloqueada mostra dica só naquele gráfico', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: '1', title: 'O que é investir', status: 'completed' }),
                lesson({ id: '2', title: 'Inflação', status: 'locked', unlocksDescription: 'Renda Fixa' }),
            ],
        })

        renderTrilha()

        const node = await screen.findByRole('button', { name: /Bloqueada: libera Renda Fixa/ })
        fireEvent.click(node)
        expect(await screen.findByText('Conclua a lição anterior pra desbloquear.')).toBeInTheDocument()
        expect(screen.queryByText('tela de lição')).not.toBeInTheDocument()
    })
})
