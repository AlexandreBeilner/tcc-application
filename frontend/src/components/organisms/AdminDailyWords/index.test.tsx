import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { createDailyWord, getDailyWords, updateDailyWord } from '../../../services/admin'
import type { DailyWord } from '../../../services/admin'
import { ApiError } from '../../../services/client'
import { AdminDailyWords } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/admin', () => ({ getDailyWords: vi.fn(), createDailyWord: vi.fn(), updateDailyWord: vi.fn() }))

const selic: DailyWord = {
    id: 'w1',
    stable_key: 'w:selic',
    answer: 'SELIC',
    display: 'Selic',
    definition: 'Taxa básica de juros.',
    learn_more: null,
    category: 'juros-e-inflacao',
    scope: 'brasil',
    active: true,
}
const copom: DailyWord = { ...selic, id: 'w2', answer: 'COPOM', display: 'Copom', definition: 'Comitê de juros.', active: false }

function renderPanel() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    return render(
        <QueryClientProvider client={client}>
            <AdminDailyWords />
        </QueryClientProvider>,
    )
}

beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useAuth).mockReturnValue({ token: 'tok', user: null, login: vi.fn() } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getDailyWords).mockResolvedValue({ words: [selic, copom] })
})

describe('AdminDailyWords', () => {
    it('lista só as ativas até pedir as desativadas', async () => {
        renderPanel()

        expect(await screen.findByText('Selic')).toBeInTheDocument()
        expect(screen.queryByText('Copom')).not.toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Mostrar desativadas'))
        expect(screen.getByText('Copom')).toBeInTheDocument()
        expect(screen.getByText('Desativada')).toBeInTheDocument()
    })

    it('cria uma palavra com os campos do formulário', async () => {
        vi.mocked(createDailyWord).mockResolvedValue({ word: selic })
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Nova palavra' }))
        expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Palavra'), { target: { value: 'Câmbio' } })
        fireEvent.change(screen.getByLabelText('Definição'), { target: { value: 'Preço de uma moeda em outra.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

        await waitFor(() =>
            expect(createDailyWord).toHaveBeenCalledWith('tok', {
                display: 'Câmbio',
                definition: 'Preço de uma moeda em outra.',
                category: 'planos-e-moeda',
                scope: 'brasil',
                learn_more: null,
            }),
        )
        expect(await screen.findByRole('status')).toHaveTextContent('Palavra criada.')
    })

    it('mostra os motivos da recusa da API no formulário', async () => {
        vi.mocked(createDailyWord).mockRejectedValue(
            new ApiError(422, 'palavra Zzyzx: fora da lista aceita', {
                code: 'invalid_daily_content',
                problems: ['palavra Zzyzx: fora da lista aceita'],
            }),
        )
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Nova palavra' }))
        fireEvent.change(screen.getByLabelText('Palavra'), { target: { value: 'Zzyzx' } })
        fireEvent.change(screen.getByLabelText('Definição'), { target: { value: 'Nada.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('fora da lista aceita')
    })

    it('desativar avisa os jogos que ainda usam a palavra', async () => {
        vi.mocked(updateDailyWord).mockResolvedValue({ word: { ...selic, active: false }, affected_puzzles: [4, 9] })
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }))

        await waitFor(() => expect(updateDailyWord).toHaveBeenCalledWith('tok', 'w1', { active: false }))
        expect(await screen.findByRole('status')).toHaveTextContent('Aparece nos jogos #4, #9')
    })

    it('editar palavra de jogo publicado pede confirmação e repete com ela', async () => {
        vi.mocked(updateDailyWord)
            .mockRejectedValueOnce(new ApiError(409, 'o item está em jogo já publicado (#3)', { code: 'confirmation_required' }))
            .mockResolvedValueOnce({ word: selic, affected_puzzles: [3] })
        renderPanel()

        fireEvent.click(await screen.findByRole('button', { name: 'Editar' }))
        fireEvent.change(screen.getByLabelText('Definição'), { target: { value: 'Outra definição.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

        expect(await screen.findByText('Palavra em jogo já publicado')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Editar mesmo assim' }))

        await waitFor(() => expect(updateDailyWord).toHaveBeenCalledTimes(2))
        expect(vi.mocked(updateDailyWord).mock.calls[1][2]).toMatchObject({ definition: 'Outra definição.', confirm_published: true })
    })
})
