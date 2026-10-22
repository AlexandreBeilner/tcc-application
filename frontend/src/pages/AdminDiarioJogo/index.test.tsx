import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getDailyPuzzle, getDailyQuestions, getDailyWords, publishDailyPuzzles, replaceDailyCard } from '../../services/admin'
import type { DailyPuzzleDetail, DailyQuestion, DailyWord } from '../../services/admin'
import { ApiError } from '../../services/client'
import { AdminDiarioJogo } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    getDailyPuzzle: vi.fn(),
    publishDailyPuzzles: vi.fn(),
    replaceDailyCard: vi.fn(),
    getDailyWords: vi.fn(),
    getDailyQuestions: vi.fn(),
}))

const word = (id: string, display: string): DailyWord => ({
    id,
    stable_key: `w:${display}`,
    answer: display.toUpperCase(),
    display,
    definition: 'Taxa básica de juros.',
    learn_more: null,
    category: 'juros-e-inflacao',
    scope: 'brasil',
    active: true,
})

const question: DailyQuestion = {
    id: 'q1',
    stable_key: 'q:k',
    question: 'Quem fixa a meta de inflação?',
    options: ['Copom', 'CMN', 'CVM'],
    correct_index: 1,
    explanation: 'O Conselho Monetário Nacional fixa a meta.',
    source_ref: 'Decreto 3.088/1999',
    learn_more: null,
    category: 'instituicoes',
    scope: 'brasil',
    active: true,
}

const puzzle = (over: Partial<DailyPuzzleDetail> = {}): DailyPuzzleDetail => ({
    number: 12,
    date: '2026-11-21',
    is_today_or_past: false,
    published_at: null,
    origins: { word: 'generated', question: 'generated' },
    word: word('w1', 'Selic'),
    question,
    warnings: ['a pergunta do dia está desativada'],
    ...over,
})

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={['/admin/diario/jogo/12']}>
                <Routes>
                    <Route path="/admin/diario/jogo/:number" element={<AdminDiarioJogo />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyWords).mockResolvedValue({ words: [word('w1', 'Selic'), word('w2', 'Copom')] })
    vi.mocked(getDailyQuestions).mockResolvedValue({ questions: [question] })
})

describe('AdminDiarioJogo', () => {
    it('mostra os dois cartões do dia com o gabarito', async () => {
        vi.mocked(getDailyPuzzle).mockResolvedValue(puzzle())
        renderPage()

        expect(await screen.findByRole('heading', { name: 'Jogo #12 · 21/11/2026' })).toBeInTheDocument()
        expect(getDailyPuzzle).toHaveBeenCalledWith('tok', 12)
        expect(screen.getByText(/CMN/)).toHaveTextContent('(correta)')
        expect(screen.getByRole('region', { name: 'Palavra do dia' })).toHaveTextContent('Selic')
        expect(screen.getByRole('region', { name: 'Pergunta do dia' })).toBeInTheDocument()
        expect(screen.queryByRole('region', { name: 'Linha do tempo' })).not.toBeInTheDocument()
        expect(screen.getByRole('list', { name: 'Avisos do dia' })).toHaveTextContent('pergunta do dia está desativada')
        expect(screen.getByText('Fora do ar')).toBeInTheDocument()
    })

    it('publica o dia direto, sem etapa de revisão', async () => {
        vi.mocked(getDailyPuzzle).mockResolvedValue(puzzle())
        vi.mocked(publishDailyPuzzles).mockResolvedValue({ published: [12] })
        renderPage()

        expect(screen.queryByRole('button', { name: 'Marcar como revisado' })).not.toBeInTheDocument()
        const publish = await screen.findByRole('button', { name: 'Publicar' })
        expect(publish).toBeEnabled()
        fireEvent.click(publish)
        await waitFor(() => expect(publishDailyPuzzles).toHaveBeenCalledWith('tok', [12]))
    })

    it('troca a palavra escolhendo outra do banco', async () => {
        vi.mocked(getDailyPuzzle).mockResolvedValue(puzzle())
        vi.mocked(replaceDailyCard).mockResolvedValue({ number: 12 })
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Trocar palavra' }))
        const list = await screen.findByRole('list', { name: 'Itens do banco' })
        expect(within(list).queryByText('Selic')).not.toBeInTheDocument()
        fireEvent.click(await within(list).findByLabelText(/Copom/))
        fireEvent.click(screen.getByRole('button', { name: 'Trocar cartão' }))

        await waitFor(() =>
            expect(replaceDailyCard).toHaveBeenCalledWith('tok', 12, { card: 'word', word_id: 'w2', confirm_published: undefined }),
        )
        expect(await screen.findByRole('status')).toHaveTextContent('Cartão trocado')
    })

    it('jogo publicado exige a confirmação marcada para trocar', async () => {
        vi.mocked(getDailyPuzzle).mockResolvedValue(puzzle({ published_at: '2026-10-20T12:00:00Z' }))
        vi.mocked(getDailyQuestions).mockResolvedValue({
            questions: [question, { ...question, id: 'q2', question: 'Qual índice mede a inflação?' }],
        })
        vi.mocked(replaceDailyCard).mockResolvedValue({ number: 12 })
        renderPage()

        fireEvent.click(await screen.findByRole('button', { name: 'Trocar pergunta' }))
        fireEvent.click(await screen.findByLabelText(/Qual índice mede a inflação/))
        const submit = screen.getByRole('button', { name: 'Trocar cartão' })
        expect(submit).toBeDisabled()

        fireEvent.click(screen.getByLabelText('Este jogo já está publicado. Confirmo a troca.'))
        expect(submit).toBeEnabled()
        fireEvent.click(submit)

        await waitFor(() =>
            expect(replaceDailyCard).toHaveBeenCalledWith('tok', 12, { card: 'question', question_id: 'q2', confirm_published: true }),
        )
    })

    it('jogo inexistente explica que a agenda só tem os dias preparados', async () => {
        vi.mocked(getDailyPuzzle).mockRejectedValue(new ApiError(404, 'jogo não encontrado'))
        renderPage()

        expect(await screen.findByRole('alert')).toHaveTextContent('Este jogo não existe')
    })
})
