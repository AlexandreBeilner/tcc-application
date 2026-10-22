import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getDailyAcceptedWords, getDailyQuestions, getDailyWords } from '../../services/admin'
import { AdminDiarioConteudo } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/admin', () => ({
    getDailyWords: vi.fn(),
    getDailyQuestions: vi.fn(),
    getDailyAcceptedWords: vi.fn(),
    createDailyWord: vi.fn(),
    updateDailyWord: vi.fn(),
}))

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyWords).mockResolvedValue({ words: [] })
    vi.mocked(getDailyQuestions).mockResolvedValue({ questions: [] })
    vi.mocked(getDailyAcceptedWords).mockResolvedValue({ words: [] })
})

describe('AdminDiarioConteudo', () => {
    it('abre em Palavras e troca de banco pelas abas', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <AdminDiarioConteudo />
                </MemoryRouter>
            </QueryClientProvider>,
        )

        expect(screen.getByRole('heading', { name: 'Conteúdo do Diário' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Palavras' })).toHaveAttribute('aria-selected', 'true')
        expect(await screen.findByText('Nenhuma palavra encontrada.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('tab', { name: 'Perguntas' }))
        expect(await screen.findByText('Nenhuma pergunta encontrada.')).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Eventos' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('tab', { name: 'Palavras aceitas' }))
        expect(await screen.findByText('A lista extra está vazia.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Voltar ao Diário' })).toHaveAttribute('href', '/admin/diario')
    })
})
