import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getRanking } from '../../services/ranking'
import type { RankingResult } from '../../services/ranking'
import { Classificacao } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/ranking', () => ({ getRanking: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/', element: <Classificacao /> }], { initialEntries: ['/'] })
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

const globalResult: RankingResult = {
    window: 'week',
    scope: 'global',
    criterion: 'overall',
    entries: [
        { userId: '1', username: 'ana', level: 4, xp: 900, profitabilityPct: 9.2, cosmetics: { frame: null, title: null } },
        { userId: 'me', username: 'eu', level: 2, xp: 250, profitabilityPct: 1.1, cosmetics: { frame: null, title: null } },
    ],
    requestingUserPosition: 2,
    page: 1,
    pageSize: 25,
    totalEntries: 2,
    totalPages: 1,
    updatedAt: null,
}

describe('Classificacao (tela 7.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: {
                id: 'me',
                name: 'Eu',
                email: 'eu@example.com',
                username: 'eu',
                role: 'user',
                onboardingCompleted: true,
                avatarUrl: null,
            },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(getRanking).mockResolvedValue(globalResult)
    })

    afterEach(() => vi.clearAllMocks())

    it('carrega o ranking global da semana, critério geral, página 1 por padrão', async () => {
        renderPage()

        await waitFor(() =>
            expect(getRanking).toHaveBeenCalledWith('token', { window: 'week', scope: 'global', criterion: 'overall', page: 1 }),
        )
        expect(await screen.findByText('ana')).toBeInTheDocument()
    })

    it('mostra a posição do usuário autenticado retornada pelo backend', async () => {
        renderPage()
        expect(await screen.findByText('Você está em Nº 2')).toBeInTheDocument()
    })

    it('avisa que a classificação é recalculada a cada 3 horas quando vem do snapshot', async () => {
        vi.mocked(getRanking).mockResolvedValue({ ...globalResult, updatedAt: new Date(Date.now() - 2 * 3_600_000).toISOString() })
        renderPage()

        expect(await screen.findByText(/Atualizado há 2 h, a classificação é recalculada a cada 3 horas/)).toBeInTheDocument()
    })

    it('explica que a renda fixa entra líquida de IR', async () => {
        renderPage()

        expect(await screen.findByText(/já descontado o Imposto de Renda/)).toBeInTheDocument()
    })

    it('não mostra o aviso de atualização quando o ranking foi calculado na hora', async () => {
        renderPage()
        await screen.findByText('ana')

        expect(screen.queryByText(/Atualizado há/)).not.toBeInTheDocument()
    })

    it('alternar pra Amigos refaz a consulta com o novo escopo', async () => {
        renderPage()
        await screen.findByText('ana')

        fireEvent.click(screen.getByRole('button', { name: 'Amigos' }))

        await waitFor(() =>
            expect(getRanking).toHaveBeenCalledWith('token', { window: 'week', scope: 'friends', criterion: 'overall', page: 1 }),
        )
    })

    it('trocar o critério pra Nível desabilita a Janela sem removê-la do layout, e omite window da consulta', async () => {
        renderPage()
        await screen.findByText('ana')

        fireEvent.click(screen.getByRole('button', { name: 'Nível' }))

        await waitFor(() =>
            expect(getRanking).toHaveBeenCalledWith('token', { window: undefined, scope: 'global', criterion: 'level', page: 1 }),
        )
        // Continua no layout (nunca desmontada) — só desabilitada, pra não
        // fazer os outros filtros saltarem de posição.
        const semanaPill = screen.getByRole('button', { name: 'Semana' })
        expect(semanaPill).toBeInTheDocument()
        expect(semanaPill).toBeDisabled()
    })

    it('clicar numa pill de Janela desabilitada não muda a consulta', async () => {
        renderPage()
        await screen.findByText('ana')

        fireEvent.click(screen.getByRole('button', { name: 'Nível' }))
        await waitFor(() => expect(getRanking).toHaveBeenCalledWith('token', expect.objectContaining({ criterion: 'level' })))
        vi.mocked(getRanking).mockClear()

        fireEvent.click(screen.getByRole('button', { name: 'Mês' }))

        expect(getRanking).not.toHaveBeenCalled()
    })
})
