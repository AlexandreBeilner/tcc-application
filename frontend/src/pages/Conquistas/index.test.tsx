import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { listAchievements } from '../../services/achievements'
import { Conquistas } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/achievements', () => ({ listAchievements: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <Conquistas />
        </QueryClientProvider>,
    )
}

describe('Conquistas (tela 7.2)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra as conquistas retornadas pelo backend', async () => {
        vi.mocked(listAchievements).mockResolvedValue({
            achievements: [
                {
                    id: '1',
                    name: 'Primeira Semana',
                    description: 'Mantenha o streak por 7 dias.',
                    criteriaType: 'streak_days',
                    criteriaValue: 7,
                    unlocked: false,
                    unlockedAt: null,
                    progress: 2,
                },
            ],
        })

        renderPage()

        expect(await screen.findByText('Primeira Semana')).toBeInTheDocument()
    })

    it('erro ao carregar mostra mensagem, sem quebrar a tela', async () => {
        vi.mocked(listAchievements).mockRejectedValue(new Error('falha de rede'))

        renderPage()

        expect(
            await screen.findByText('Não foi possível carregar suas conquistas agora. Tente novamente em instantes.'),
        ).toBeInTheDocument()
    })
})
