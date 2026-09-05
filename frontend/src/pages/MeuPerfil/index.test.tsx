import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { getMyProfile } from '../../services/profile'
import { MeuPerfil } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/profile', () => ({ getMyProfile: vi.fn() }))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/perfil', element: <MeuPerfil /> }], { initialEntries: ['/perfil'] })
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('MeuPerfil (tela 9.1)', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra o próprio perfil com o link de editar', async () => {
        vi.mocked(getMyProfile).mockResolvedValue({
            profile: { username: 'ana', level: 2, xp: 150, currentStreak: 1, achievements: [], profitabilityPct: 1.4, window: 'week' },
        })

        renderPage()

        expect(await screen.findByText('@ana')).toBeInTheDocument()
        expect(screen.getByText('Este é o seu perfil')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Editar perfil/ })).toHaveAttribute('href', '/configuracoes')
        expect(getMyProfile).toHaveBeenCalledWith('token')
    })

    it('erro ao carregar mostra mensagem, sem quebrar a tela', async () => {
        vi.mocked(getMyProfile).mockRejectedValue(new Error('falha'))

        renderPage()

        expect(await screen.findByText('Não foi possível carregar seu perfil agora. Tente novamente em instantes.')).toBeInTheDocument()
    })
})
