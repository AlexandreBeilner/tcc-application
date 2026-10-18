import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getReviewSession, listLessons } from '../../services/lessons'
import type { Lesson } from '../../services/lessons'
import { getProgression, getStreak } from '../../services/gamification'
import { TrilhasHub } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/lessons', () => ({ listLessons: vi.fn(), getReviewSession: vi.fn() }))
vi.mock('../../services/gamification', () => ({ getProgression: vi.fn(), getStreak: vi.fn() }))

function renderHub() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/trilha', element: <TrilhasHub /> },
            { path: '/trilha/mapa/:trackNumber', element: <div>tela de mapa da trilha</div> },
            { path: '/trilha/revisao', element: <div>tela de revisão</div> },
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
        microDecisionOptions: null,
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

describe('TrilhasHub (tela 3.1, backlog engajamento O.1)', () => {
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
            monthlySalary: 200,
        })
        vi.mocked(getStreak).mockResolvedValue({ currentStreak: 1, longestStreak: 1 })
        vi.mocked(getReviewSession).mockResolvedValue({ ready: false, questions: [] })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('mostra o progresso geral e um card por trilha', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: '1', status: 'completed' }),
                lesson({ id: '2', trackNumber: 1, trackName: 'Renda Fixa', status: 'available' }),
            ],
        })

        renderHub()

        await waitFor(() => expect(screen.getByText('1 de 2 lições concluídas no total')).toBeInTheDocument())
        expect(screen.getByText('Fundamentos')).toBeInTheDocument()
        // "Renda Fixa" aparece 2x: no card da trilha e no ResumeLessonCard da
        // barra lateral (mesma lição `available`, dois lugares diferentes).
        expect(screen.getAllByText('Renda Fixa').length).toBeGreaterThan(0)
    })

    it('card de trilha 100% concluída mostra status "Concluída" e a fração completa', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'completed' })],
        })

        renderHub()

        expect(await screen.findByRole('button', { name: /Fundamentos, Concluída, 2 de 2 lições concluídas/ })).toBeInTheDocument()
    })

    it('card de trilha com lição available mostra status "Em andamento"', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'available' })],
        })

        renderHub()

        expect(await screen.findByRole('button', { name: /Em andamento/ })).toBeInTheDocument()
    })

    it('card de trilha sem nenhuma lição available/completed mostra status "Bloqueada" e a dica de desbloqueio', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', status: 'locked' }), lesson({ id: '2', status: 'locked' })],
        })

        renderHub()

        expect(await screen.findByRole('button', { name: /Bloqueada/ })).toBeInTheDocument()
        expect(screen.getByText('Desbloqueia ao concluir a trilha anterior')).toBeInTheDocument()
    })

    it('clicar num card de trilha em andamento navega pro mapa vertical (/trilha/mapa/:trackNumber)', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', trackNumber: 2, trackName: 'Renda Variável', status: 'available' })],
        })

        renderHub()

        const card = await screen.findByRole('button', { name: /^Renda Variável/ })
        fireEvent.click(card)

        expect(await screen.findByText('tela de mapa da trilha')).toBeInTheDocument()
    })

    it('clicar num card de trilha 100% bloqueada TAMBÉM navega pro mapa (bloqueio é convite, não parede)', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: '1', trackNumber: 3, trackName: 'Estratégia e Tributação', status: 'locked' })],
        })

        renderHub()

        const card = await screen.findByRole('button', { name: /Bloqueada/ })
        fireEvent.click(card)

        expect(await screen.findByText('tela de mapa da trilha')).toBeInTheDocument()
    })

    it('mostra "faltam N lições" pro próximo desbloqueio, batendo com o sortOrder da lição-alvo', async () => {
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [
                lesson({ id: '1', sortOrder: 1, status: 'completed', unlocksDescription: 'Acesso ao Portfólio' }),
                lesson({ id: '2', sortOrder: 2, status: 'available' }),
                lesson({
                    id: '3',
                    sortOrder: 3,
                    status: 'locked',
                    unlocksDescription: 'Acesso à Trilha 1 (Renda Fixa)',
                }),
            ],
        })

        renderHub()

        expect(await screen.findByText(/Faltam 2 lições pra:/)).toBeInTheDocument()
        expect(screen.getByText('Acesso à Trilha 1 (Renda Fixa)')).toBeInTheDocument()
    })

    it('erro ao carregar as trilhas mostra mensagem', async () => {
        vi.mocked(listLessons).mockRejectedValue(new Error('falha de rede'))

        renderHub()

        expect(await screen.findByText('Não foi possível carregar as trilhas agora. Tente novamente em instantes.')).toBeInTheDocument()
    })

    describe('revisão de 1 minuto (LJ.5.6)', () => {
        const question = (id: string) => ({
            lessonId: 'lesson-1',
            lessonTitle: 'O que é investir',
            block: { type: 'check', id, kind: 'single', prompt: id, options: ['a', 'b'] },
        })

        it('sem as 3 perguntas vencidas, o cartão não aparece', async () => {
            vi.mocked(listLessons).mockResolvedValue({ lessons: [lesson({ id: '1', status: 'available' })] })

            renderHub()

            await screen.findByText('Trilhas')
            await waitFor(() => expect(getReviewSession).toHaveBeenCalled())
            expect(screen.queryByText('Revisão de 1 minuto')).not.toBeInTheDocument()
        })

        it('com as 3 vencidas, mostra o convite sem contagem de pendência e abre a revisão', async () => {
            vi.mocked(listLessons).mockResolvedValue({ lessons: [lesson({ id: '1', status: 'available' })] })
            vi.mocked(getReviewSession).mockResolvedValue({ ready: true, questions: [question('a'), question('b'), question('c')] })

            renderHub()

            const card = await screen.findByRole('button', { name: /Revisão de 1 minuto/ })
            expect(card).toHaveTextContent('3 perguntas')
            expect(card.textContent).not.toMatch(/atrasad|pendente|restam/i)
            fireEvent.click(card)
            expect(await screen.findByText('tela de revisão')).toBeInTheDocument()
        })
    })
})
