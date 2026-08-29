import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeOnboarding } from '../../services/auth'
import { useAuth } from '../../features/auth/AuthContext'
import { Onboarding } from '.'

vi.mock('../../services/auth', () => ({
    completeOnboarding: vi.fn(),
}))

vi.mock('../../features/auth/AuthContext', () => ({
    useAuth: vi.fn(),
}))

function renderOnboarding() {
    const router = createMemoryRouter(
        [
            { path: '/onboarding', element: <Onboarding /> },
            { path: '/trilha', element: <div>mapa da trilha</div> },
            { path: '/', element: <div>portfolio</div> },
        ],
        { initialEntries: ['/onboarding'] },
    )
    return render(<RouterProvider router={router} />)
}

function mockAuth(onboardingCompleted: boolean, setUser = vi.fn()) {
    vi.mocked(useAuth).mockReturnValue({
        token: 'token-valido',
        user: {
            id: '1',
            name: 'Ana',
            email: 'ana@example.com',
            username: 'ana',
            role: 'user',
            onboardingCompleted,
        },
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        setUser,
    })
}

describe('Onboarding (tela 1.2)', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('primeiro slide mostra "Próximo", não "Começar"', () => {
        mockAuth(false)

        renderOnboarding()

        expect(screen.getByText('Você começa com R$ 10.000 simulados')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument()
    })

    it('avançar até o último slide troca o botão pra "Começar"', () => {
        mockAuth(false)

        renderOnboarding()
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))

        expect(screen.getByText('Compita com amigos, não só com estranhos')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Começar' })).toBeInTheDocument()
    })

    it('"Começar" marca onboardingCompleted e navega pra /trilha (3.1, não 2.1)', async () => {
        const setUser = vi.fn()
        mockAuth(false, setUser)
        vi.mocked(completeOnboarding).mockResolvedValue({
            user: {
                id: '1',
                name: 'Ana',
                email: 'ana@example.com',
                username: 'ana',
                role: 'user',
                onboardingCompleted: true,
            },
        })

        renderOnboarding()
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
        fireEvent.click(screen.getByRole('button', { name: 'Começar' }))

        await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith('token-valido'))
        expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ onboardingCompleted: true }))
        await waitFor(() => expect(screen.getByText('mapa da trilha')).toBeInTheDocument())
    })

    it('"Pular" também marca onboardingCompleted e navega pra /trilha, de qualquer slide', async () => {
        const setUser = vi.fn()
        mockAuth(false, setUser)
        vi.mocked(completeOnboarding).mockResolvedValue({
            user: {
                id: '1',
                name: 'Ana',
                email: 'ana@example.com',
                username: 'ana',
                role: 'user',
                onboardingCompleted: true,
            },
        })

        renderOnboarding()
        fireEvent.click(screen.getByRole('button', { name: 'Pular' }))

        await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith('token-valido'))
        await waitFor(() => expect(screen.getByText('mapa da trilha')).toBeInTheDocument())
    })

    it('onboarding já concluído redireciona pra "/" sem mostrar o carrossel', () => {
        mockAuth(true)

        renderOnboarding()

        expect(screen.getByText('portfolio')).toBeInTheDocument()
    })
})
