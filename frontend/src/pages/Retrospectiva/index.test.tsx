import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getMyCosmetics } from '../../services/cosmetics'
import { getRetrospective, listRetrospectiveMonths } from '../../services/retrospectives'
import type { Retrospective } from '../../services/retrospectives'
import { Retrospectiva } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/cosmetics', () => ({ getMyCosmetics: vi.fn() }))
vi.mock('../../services/retrospectives', () => ({ listRetrospectiveMonths: vi.fn(), getRetrospective: vi.fn() }))

const retro = (month: string, lessons: number): Retrospective => ({
    month,
    lessonsCompleted: lessons,
    achievementsUnlocked: 0,
    achievementNames: [],
    level: 3,
    activeDays: [],
    daysInMonth: 30,
    longestStreak: 0,
    bestReturnPct: null,
    duelsPlayed: 0,
    duelsWon: 0,
    leaguesActive: 0,
    empty: false,
})

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Retrospectiva />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Retrospectiva (MO.5.4)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'token', user: { id: 'u1', username: 'ana' } } as ReturnType<typeof useAuth>)
        vi.mocked(getMyCosmetics).mockResolvedValue({
            referralCount: 0,
            catalog: [],
            selection: { frame: null, title: null },
            display: { frame: null, title: null },
        })
    })
    afterEach(() => vi.clearAllMocks())

    it('abre no mês mais recente e troca de mês pelos botões', async () => {
        vi.mocked(listRetrospectiveMonths).mockResolvedValue(['2026-09', '2026-08'])
        vi.mocked(getRetrospective).mockImplementation(async (_t, month) => retro(month, month === '2026-09' ? 6 : 2))
        renderPage()

        expect(await screen.findByRole('region', { name: 'Retrospectiva de setembro de 2026' })).toBeInTheDocument()
        expect(getRetrospective).toHaveBeenCalledWith('token', '2026-09')

        fireEvent.click(screen.getByRole('button', { name: 'agosto de 2026' }))
        expect(await screen.findByRole('region', { name: 'Retrospectiva de agosto de 2026' })).toBeInTheDocument()
    })

    it('conta nova, sem mês fechado, recebe uma explicação e nenhuma cobrança', async () => {
        vi.mocked(listRetrospectiveMonths).mockResolvedValue([])
        renderPage()
        expect(
            await screen.findByText(/Sua primeira retrospectiva aparece quando o seu primeiro mês completo terminar/),
        ).toBeInTheDocument()
        await waitFor(() => expect(getRetrospective).not.toHaveBeenCalled())
    })

    it('erro de carregamento mostra mensagem amigável', async () => {
        vi.mocked(listRetrospectiveMonths).mockRejectedValue(new Error('x'))
        renderPage()
        expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar suas retrospectivas')
    })
})
