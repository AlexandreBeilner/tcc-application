import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { createDailyQuestion, getDailyQuestions, updateDailyQuestion } from '../../../services/admin'
import type { DailyQuestion } from '../../../services/admin'
import { AdminDailyQuestions } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({
    getDailyQuestions: vi.fn(),
    createDailyQuestion: vi.fn(),
    updateDailyQuestion: vi.fn(),
}))

const meta: DailyQuestion = {
    id: 'q1',
    stable_key: 'q:meta',
    question: 'Quem fixa a meta de inflação?',
    options: ['Copom', 'CMN', 'CVM'],
    correct_index: 1,
    explanation: 'O CMN fixa a meta.',
    source_ref: 'Decreto 3.088/1999',
    learn_more: null,
    category: 'instituicoes',
    scope: 'brasil',
    active: true,
}

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <AdminDailyQuestions />
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyQuestions).mockResolvedValue({ questions: [meta] })
})

describe('AdminDailyQuestions', () => {
    it('mostra a pergunta com a fonte', async () => {
        renderPanel()

        expect(await screen.findByText('Quem fixa a meta de inflação?')).toBeInTheDocument()
        expect(screen.getByText('Fonte: Decreto 3.088/1999')).toBeInTheDocument()
    })

    it('só deixa salvar com fonte, duas alternativas e explicação', async () => {
        vi.mocked(createDailyQuestion).mockResolvedValue({ question: meta })
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Nova pergunta' }))
        fireEvent.change(screen.getByLabelText('Pergunta'), { target: { value: 'Qual índice mede a inflação?' } })
        fireEvent.change(screen.getByLabelText('Alternativas'), { target: { value: 'IPCA\nIGP-M\n' } })
        fireEvent.change(screen.getByLabelText('Explicação'), { target: { value: 'O IPCA é o oficial.' } })
        const save = screen.getByRole('button', { name: 'Salvar' })
        expect(save).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Fonte primária'), { target: { value: 'IBGE' } })
        expect(save).toBeEnabled()
        fireEvent.change(screen.getByLabelText('Alternativa correta'), { target: { value: '1' } })
        fireEvent.click(save)

        await waitFor(() =>
            expect(createDailyQuestion).toHaveBeenCalledWith('tok', {
                question: 'Qual índice mede a inflação?',
                options: ['IPCA', 'IGP-M'],
                correct_index: 1,
                explanation: 'O IPCA é o oficial.',
                source_ref: 'IBGE',
                category: 'planos-e-moeda',
                scope: 'brasil',
                learn_more: null,
            }),
        )
    })

    it('editar avisa em quais jogos a pergunta aparece', async () => {
        vi.mocked(updateDailyQuestion).mockResolvedValue({ question: meta, affected_puzzles: [5] })
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
        fireEvent.change(screen.getByLabelText('Explicação'), { target: { value: 'O Conselho Monetário Nacional fixa a meta.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

        expect(await screen.findByRole('status')).toHaveTextContent('Aparece nos jogos #5.')
    })
})
