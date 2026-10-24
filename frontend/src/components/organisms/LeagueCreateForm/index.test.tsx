import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../../features/auth/AuthContext'
import { ApiError } from '../../../services/client'
import { createLeague } from '../../../services/leagues'
import { LeagueCreateForm } from '.'

vi.mock('../../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/leagues', () => ({ createLeague: vi.fn() }))

function renderForm(onCreated = vi.fn()) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <LeagueCreateForm onCreated={onCreated} />
            </MemoryRouter>
        </QueryClientProvider>,
    )
    return onCreated
}

describe('LeagueCreateForm (MO.5.2c)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token' } as ReturnType<typeof useAuth>)
    })
    afterEach(() => vi.clearAllMocks())

    it('cria a liga com nome e período e é levado ao detalhe', async () => {
        vi.mocked(createLeague).mockResolvedValue({ id: 'l1' })
        const onCreated = renderForm()

        fireEvent.change(await screen.findByLabelText('Nome da liga'), { target: { value: 'Turma TCC' } })
        fireEvent.click(screen.getByRole('button', { name: 'Mês' }))
        fireEvent.click(screen.getByRole('button', { name: 'Criar liga' }))

        await waitFor(() => expect(createLeague).toHaveBeenCalledWith('token', { name: 'Turma TCC', window: 'month' }))
        await waitFor(() => expect(onCreated).toHaveBeenCalledWith('l1'))
    })

    it('mostra o limite de 3 ligas dito pelo servidor', async () => {
        vi.mocked(createLeague).mockRejectedValue(new ApiError(409, 'você já tem 3 ligas abertas; encerre uma para criar outra'))
        renderForm()

        fireEvent.change(await screen.findByLabelText('Nome da liga'), { target: { value: 'Quarta' } })
        fireEvent.click(screen.getByRole('button', { name: 'Criar liga' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('encerre uma para criar outra')
    })
})
