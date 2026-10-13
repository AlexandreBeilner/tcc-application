import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeOnboarding } from '../../services/auth'
import { updateEmailPreferences } from '../../services/emailPreferences'
import { useAuth } from '../../features/auth/AuthContext'
import { Onboarding } from '.'

vi.mock('../../services/auth', () => ({
    completeOnboarding: vi.fn(),
}))

vi.mock('../../services/emailPreferences', () => ({
    updateEmailPreferences: vi.fn(),
}))

vi.mock('../../features/auth/AuthContext', () => ({
    useAuth: vi.fn(),
}))

// Mostra o `state` com que a trilha foi aberta, para provar que o onboarding avisa o InstallPrompt.
function TrailProbe() {
    const location = useLocation()
    return <div>mapa da trilha {JSON.stringify(location.state)}</div>
}

function renderOnboarding() {
    const router = createMemoryRouter(
        [
            { path: '/onboarding', element: <Onboarding /> },
            { path: '/trilha', element: <TrailProbe /> },
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
            avatarUrl: null,
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

    it('o terceiro slide explica o tempo acelerado e o fim de semana fechado (S.12)', () => {
        mockAuth(false)

        renderOnboarding()
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))

        expect(screen.getByText('Aqui o tempo passa mais rápido')).toBeInTheDocument()
        expect(screen.getByText(/5 dias a cada dia real/)).toBeInTheDocument()
        expect(screen.getByRole('img', { name: /fechado no sábado e no domingo/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument()
    })

    it('o quarto slide explica o salário mensal (T.11)', () => {
        mockAuth(false)

        renderOnboarding()
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))

        expect(screen.getByText('Seu salário cresce com você')).toBeInTheDocument()
        expect(screen.getByText(/5º dia útil do mês/)).toBeInTheDocument()
        expect(screen.getByText('no nível 10')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument()
    })

    const NEXT = { name: 'Próximo' }
    const advanceToEmailStep = () => {
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', NEXT))
    }
    const completedUser = {
        id: '1',
        name: 'Ana',
        email: 'ana@example.com',
        username: 'ana',
        role: 'user' as const,
        onboardingCompleted: true,
        avatarUrl: null,
    }

    it('o quinto slide continua sendo o dos amigos e ainda mostra "Próximo"', () => {
        mockAuth(false)

        renderOnboarding()
        for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', NEXT))

        expect(screen.getByText('Compita com amigos, não só com estranhos')).toBeInTheDocument()
        expect(screen.getByRole('button', NEXT)).toBeInTheDocument()
    })

    it('o último passo pergunta sobre e-mails, tudo desligado, e só aí troca o botão pra "Começar" (EM.6.1)', () => {
        mockAuth(false)

        renderOnboarding()
        advanceToEmailStep()

        expect(screen.getByText('Quer receber e-mails da plataforma?')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: /Amigos/ })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: /Resumo e lembretes/ })).not.toBeChecked()
        expect(screen.getByRole('button', { name: 'Começar' })).toBeInTheDocument()
    })

    it('"Começar" sem marcar nada não grava preferência, marca onboardingCompleted e navega pra /trilha', async () => {
        const setUser = vi.fn()
        mockAuth(false, setUser)
        vi.mocked(completeOnboarding).mockResolvedValue({ user: completedUser })

        renderOnboarding()
        advanceToEmailStep()
        fireEvent.click(screen.getByRole('button', { name: 'Começar' }))

        await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith('token-valido'))
        expect(updateEmailPreferences).not.toHaveBeenCalled()
        expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ onboardingCompleted: true }))
        await waitFor(() => expect(screen.getByText(/mapa da trilha/)).toBeInTheDocument())
    })

    it('ao concluir, abre a trilha com fromOnboarding para o popup de instalação aparecer uma vez', async () => {
        mockAuth(false)
        vi.mocked(completeOnboarding).mockResolvedValue({ user: completedUser })

        renderOnboarding()
        advanceToEmailStep()
        fireEvent.click(screen.getByRole('button', { name: 'Começar' }))

        expect(await screen.findByText(/mapa da trilha/)).toHaveTextContent('{"fromOnboarding":true}')
    })

    it('"Começar" com categorias marcadas grava a escolha antes de concluir', async () => {
        mockAuth(false)
        vi.mocked(updateEmailPreferences).mockResolvedValue({ preferences: { social: false, engagement: true } })
        vi.mocked(completeOnboarding).mockResolvedValue({ user: completedUser })

        renderOnboarding()
        advanceToEmailStep()
        fireEvent.click(screen.getByRole('checkbox', { name: /Resumo e lembretes/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Começar' }))

        await waitFor(() => expect(updateEmailPreferences).toHaveBeenCalledWith('token-valido', { social: false, engagement: true }))
        await waitFor(() => expect(screen.getByText(/mapa da trilha/)).toBeInTheDocument())
    })

    it('falhar ao gravar a escolha de e-mail não trava o onboarding (o padrão é desligado)', async () => {
        mockAuth(false)
        vi.mocked(updateEmailPreferences).mockRejectedValue(new Error('rede'))
        vi.mocked(completeOnboarding).mockResolvedValue({ user: completedUser })

        renderOnboarding()
        advanceToEmailStep()
        fireEvent.click(screen.getByRole('checkbox', { name: /Amigos/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Começar' }))

        await waitFor(() => expect(screen.getByText(/mapa da trilha/)).toBeInTheDocument())
    })

    it('"Pular" no passo de e-mail nunca liga nada, mesmo com caixa marcada', async () => {
        mockAuth(false)
        vi.mocked(completeOnboarding).mockResolvedValue({ user: completedUser })

        renderOnboarding()
        advanceToEmailStep()
        fireEvent.click(screen.getByRole('checkbox', { name: /Amigos/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Pular' }))

        await waitFor(() => expect(screen.getByText(/mapa da trilha/)).toBeInTheDocument())
        expect(updateEmailPreferences).not.toHaveBeenCalled()
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
                avatarUrl: null,
            },
        })

        renderOnboarding()
        fireEvent.click(screen.getByRole('button', { name: 'Pular' }))

        await waitFor(() => expect(completeOnboarding).toHaveBeenCalledWith('token-valido'))
        await waitFor(() => expect(screen.getByText(/mapa da trilha/)).toBeInTheDocument())
    })

    it('onboarding já concluído redireciona pra "/" sem mostrar o carrossel', () => {
        mockAuth(true)

        renderOnboarding()

        expect(screen.getByText('portfolio')).toBeInTheDocument()
    })
})
