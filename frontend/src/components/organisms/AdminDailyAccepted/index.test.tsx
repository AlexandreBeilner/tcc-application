import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { addDailyAcceptedWord, getDailyAcceptedWords, removeDailyAcceptedWord } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminDailyAccepted } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({
    getDailyAcceptedWords: vi.fn(),
    addDailyAcceptedWord: vi.fn(),
    removeDailyAcceptedWord: vi.fn(),
}))

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <AdminDailyAccepted />
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyAcceptedWords).mockResolvedValue({ words: ['SELIC'] })
})

describe('AdminDailyAccepted', () => {
    it('adiciona uma palavra aceita e limpa o campo', async () => {
        vi.mocked(addDailyAcceptedWord).mockResolvedValue({ word: 'COPOM' })
        renderPanel()

        const input = await screen.findByLabelText('Nova palavra aceita')
        fireEvent.change(input, { target: { value: 'copom' } })
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

        await waitFor(() => expect(addDailyAcceptedWord).toHaveBeenCalledWith('tok', 'copom'))
        expect(await screen.findByRole('status')).toHaveTextContent('COPOM agora é aceita como palpite.')
        expect(input).toHaveValue('')
    })

    it('remove da lista extra e mostra a recusa de palavra-resposta', async () => {
        vi.mocked(removeDailyAcceptedWord).mockRejectedValue(
            new ApiError(409, 'SELIC é palavra-resposta e precisa continuar na lista aceita', { code: 'word_in_use' }),
        )
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))

        await waitFor(() => expect(removeDailyAcceptedWord).toHaveBeenCalledWith('tok', 'SELIC'))
        expect(await screen.findByRole('alert')).toHaveTextContent('precisa continuar na lista aceita')
    })

    it('lista vazia explica o estado', async () => {
        vi.mocked(getDailyAcceptedWords).mockResolvedValue({ words: [] })
        renderPanel()

        expect(await screen.findByText('A lista extra está vazia.')).toBeInTheDocument()
    })
})
