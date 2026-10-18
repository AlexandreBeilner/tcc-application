import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { answerCheckpoint, getReviewSession, recordReviewResult } from '../../services/lessons'
import { RevisaoRapida } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/lessons', () => ({
    getReviewSession: vi.fn(),
    recordReviewResult: vi.fn(),
    answerCheckpoint: vi.fn(),
}))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter(
        [
            { path: '/trilha/revisao', element: <RevisaoRapida /> },
            { path: '/trilha', element: <div>tela de trilha</div> },
        ],
        { initialEntries: ['/trilha/revisao'] },
    )
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const question = (id: string, lessonId = 'l1') => ({
    lessonId,
    lessonTitle: `Lição ${lessonId}`,
    block: { type: 'check', id, kind: 'single', prompt: `Pergunta ${id}`, options: ['certa', 'errada'] },
})

describe('RevisaoRapida (LJ.5.6)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token-valido',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(recordReviewResult).mockResolvedValue({ recorded: true })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('sem revisão pronta, avisa e volta para a trilha', async () => {
        vi.mocked(getReviewSession).mockResolvedValue({ ready: false, questions: [] })

        renderPage()

        expect(await screen.findByText('Nada para revisar agora')).toBeInTheDocument()
        expect(answerCheckpoint).not.toHaveBeenCalled()
    })

    it('acerta de primeira, erra e depois acerta, e pula: grava cada resultado e mostra o resumo', async () => {
        vi.mocked(getReviewSession).mockResolvedValue({
            ready: true,
            questions: [question('a'), question('b', 'l2'), question('c', 'l3')],
        })
        vi.mocked(answerCheckpoint)
            // a: acerta de primeira
            .mockResolvedValueOnce({ correct: true, attempts: 2, firstTry: false, wrongOptions: [], explanation: 'ok a' })
            // b: erra, depois acerta
            .mockResolvedValueOnce({ correct: false, attempts: 2, firstTry: false, wrongOptions: [], explanation: 'ok b' })
            .mockResolvedValueOnce({ correct: true, attempts: 2, firstTry: false, wrongOptions: [], explanation: 'ok b' })

        renderPage()

        // Pergunta 1
        expect(await screen.findByRole('heading', { name: 'Pergunta 1 de 3' })).toBeInTheDocument()
        expect(screen.getByText('Da lição: Lição l1')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'certa' }))
        fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
        expect(await screen.findByText('Isso ficou!')).toBeInTheDocument()
        expect(answerCheckpoint).toHaveBeenLastCalledWith('token-valido', 'l1', 'a', { selectedOption: 0 }, { practice: true })
        await waitFor(() => expect(recordReviewResult).toHaveBeenCalledWith('token-valido', 'l1', 'a', true))
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        // Pergunta 2: erra, depois acerta
        expect(await screen.findByRole('heading', { name: 'Pergunta 2 de 3' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'errada' }))
        fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
        expect(await screen.findByText('ok b')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'certa' }))
        fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
        expect(await screen.findByText('Agora ficou.')).toBeInTheDocument()
        await waitFor(() => expect(recordReviewResult).toHaveBeenCalledWith('token-valido', 'l2', 'b', false))
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        // Pergunta 3: pula sem responder, nada é gravado
        expect(await screen.findByRole('heading', { name: 'Pergunta 3 de 3' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Pular' }))

        expect(await screen.findByRole('heading', { name: 'Revisão feita' })).toBeInTheDocument()
        expect(screen.getByText(/1 de 3 de primeira/)).toBeInTheDocument()
        expect(recordReviewResult).toHaveBeenCalledTimes(2)
        expect(screen.queryByText(/XP|atrasad/)).not.toBeInTheDocument()
    })

    it('pular depois de errar grava o erro (volta ao primeiro retorno)', async () => {
        vi.mocked(getReviewSession).mockResolvedValue({
            ready: true,
            questions: [question('a'), question('b'), question('c')],
        })
        vi.mocked(answerCheckpoint).mockResolvedValueOnce({
            correct: false,
            attempts: 2,
            firstTry: false,
            wrongOptions: [],
            explanation: 'x',
        })

        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'errada' }))
        fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
        await screen.findByText('x')
        fireEvent.click(screen.getByRole('button', { name: 'Pular' }))

        await waitFor(() => expect(recordReviewResult).toHaveBeenCalledWith('token-valido', 'l1', 'a', false))
        expect(await screen.findByRole('heading', { name: 'Pergunta 2 de 3' })).toBeInTheDocument()
    })
})
