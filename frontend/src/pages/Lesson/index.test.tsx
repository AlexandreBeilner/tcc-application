import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { advanceLesson, getLesson, listLessons } from '../../services/lessons'
import type { Lesson as LessonType } from '../../services/lessons'
import { Lesson } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/lessons', () => ({ getLesson: vi.fn(), listLessons: vi.fn(), advanceLesson: vi.fn() }))

function renderLesson(id = 'lesson-1') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/trilha', element: <div>tela de trilha</div> },
            { path: '/trilha/:id', element: <Lesson /> },
        ],
        { initialEntries: [`/trilha/${id}`] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

function lesson(overrides: Partial<LessonType>): LessonType {
    return {
        id: 'lesson-1',
        code: '0.5',
        title: 'Diversificação',
        trackNumber: 0,
        trackName: 'Fundamentos',
        sortOrder: 5,
        centralConcept: 'Espalhar capital reduz risco',
        unlocksDescription: 'Tesouro Selic',
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

describe('Lesson (tela 3.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token-valido',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(listLessons).mockResolvedValue({ lessons: [] })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('lição nova abre no passo 0 (Cenário)', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })

        renderLesson()

        expect(await screen.findByText('Cenário')).toBeInTheDocument()
        expect(screen.getByText('Diversificação')).toBeInTheDocument()
        expect(screen.getByText('Espalhar capital reduz risco')).toBeInTheDocument()
    })

    it('retoma no meio (currentStep vindo do backend), sem voltar ao passo 0', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })

        renderLesson()

        expect(await screen.findByText('Revelação')).toBeInTheDocument()
    })

    it('avança do passo 0 chamando POST progress com step 1', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 1, completed: false })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

        await waitFor(() => expect(advanceLesson).toHaveBeenCalledWith('token-valido', 'lesson-1', 1))
        expect(await screen.findByText('Micro-decisão')).toBeInTheDocument()
    })

    it('passo de micro-decisão exige confirmação antes de habilitar Continuar', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 1 }) })

        renderLesson()

        const button = await screen.findByRole('button', { name: 'Continuar' })
        expect(button).toBeDisabled()

        fireEvent.click(screen.getByRole('checkbox'))
        expect(button).not.toBeDisabled()
    })

    it('ao chegar no passo 3 mostra o desbloqueio com o que foi liberado', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 2 }) })
        vi.mocked(advanceLesson).mockResolvedValue({ currentStep: 3, completed: true })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

        expect(await screen.findByText('Desbloqueio')).toBeInTheDocument()
        expect(screen.getByText('Tesouro Selic')).toBeInTheDocument()
    })

    it('lição já concluída reabre direto no desbloqueio (modo revisão), sem recreditar', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, status: 'completed' }) })

        renderLesson()

        expect(await screen.findByText('Desbloqueio')).toBeInTheDocument()
        expect(advanceLesson).not.toHaveBeenCalled()
    })

    it('"Continuar" no desbloqueio navega pra próxima lição por sortOrder', async () => {
        vi.mocked(getLesson).mockImplementation((_token, id) =>
            Promise.resolve({
                lesson:
                    id === 'lesson-1'
                        ? lesson({ id: 'lesson-1', currentStep: 3, sortOrder: 5 })
                        : lesson({ id: 'lesson-2', currentStep: 0, sortOrder: 6, title: 'Tesouro Selic' }),
            }),
        )
        vi.mocked(listLessons).mockResolvedValue({
            lessons: [lesson({ id: 'lesson-1', sortOrder: 5 }), lesson({ id: 'lesson-2', sortOrder: 6, title: 'Tesouro Selic' })],
        })

        renderLesson('lesson-1')

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
        await waitFor(() => expect(screen.getByText('Cenário')).toBeInTheDocument())
        expect(getLesson).toHaveBeenLastCalledWith('token-valido', 'lesson-2')
    })

    it('sem próxima lição, "Continuar" no desbloqueio volta pra Trilha', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 3, sortOrder: 5 }) })
        vi.mocked(listLessons).mockResolvedValue({ lessons: [lesson({ id: 'lesson-1', sortOrder: 5 })] })

        renderLesson('lesson-1')

        fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
        expect(await screen.findByText('tela de trilha')).toBeInTheDocument()
    })

    it('"Sair da lição" volta pra Trilha a qualquer momento', async () => {
        vi.mocked(getLesson).mockResolvedValue({ lesson: lesson({ currentStep: 0 }) })

        renderLesson()

        fireEvent.click(await screen.findByRole('button', { name: '← Sair da lição' }))
        expect(await screen.findByText('tela de trilha')).toBeInTheDocument()
    })

    it('lição bloqueada/inexistente mostra erro', async () => {
        vi.mocked(getLesson).mockRejectedValue(new Error('bloqueada'))

        renderLesson()

        expect(
            await screen.findByText('Não foi possível carregar esta lição agora. Ela pode estar bloqueada ou não existir.'),
        ).toBeInTheDocument()
    })
})
