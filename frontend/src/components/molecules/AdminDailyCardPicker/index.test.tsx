import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { getDailyQuestions, getDailyWords } from '../../../services/admin'
import type { DailyWord } from '../../../services/admin'
import { AdminDailyCardPicker } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({ getDailyWords: vi.fn(), getDailyQuestions: vi.fn() }))

const word = (id: string, display: string, active = true): DailyWord => ({
    id,
    stable_key: id,
    answer: display.toUpperCase(),
    display,
    definition: 'x',
    learn_more: null,
    category: 'juros-e-inflacao',
    scope: 'brasil',
    active,
})

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyWords).mockResolvedValue({ words: [word('w1', 'Selic'), word('w2', 'Câmbio'), word('w3', 'Copom', false)] })
    vi.mocked(getDailyQuestions).mockResolvedValue({ questions: [] })
})

function renderPicker(onSubmit = vi.fn()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={client}>
            <AdminDailyCardPicker
                card="word"
                currentIds={['w1']}
                published={false}
                pending={false}
                error={null}
                onSubmit={onSubmit}
                onCancel={vi.fn()}
            />
        </QueryClientProvider>,
    )
    return onSubmit
}

describe('AdminDailyCardPicker', () => {
    it('oferece só itens ativos e esconde o que já está no jogo', async () => {
        renderPicker()

        expect(await screen.findByLabelText(/Câmbio/)).toBeInTheDocument()
        expect(screen.queryByLabelText(/Selic/)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/Copom/)).not.toBeInTheDocument()
    })

    it('busca ignorando acento e caixa', async () => {
        renderPicker()

        await screen.findByLabelText(/Câmbio/)
        fireEvent.change(screen.getByLabelText('Buscar no banco'), { target: { value: 'cambio' } })
        expect(screen.getByLabelText(/Câmbio/)).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Buscar no banco'), { target: { value: 'zzz' } })
        expect(screen.getByText('Nenhum item encontrado.')).toBeInTheDocument()
    })

    it('envia a escolha sem confirmação quando o jogo não está publicado', async () => {
        const onSubmit = renderPicker()

        fireEvent.click(await screen.findByLabelText(/Câmbio/))
        fireEvent.click(screen.getByRole('button', { name: 'Trocar cartão' }))

        expect(onSubmit).toHaveBeenCalledWith({ card: 'word', word_id: 'w2', confirm_published: undefined })
    })
})
