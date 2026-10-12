import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { useTheme } from '../../features/theme/ThemeContext'
import { ApiError } from '../../services/client'
import { changePassword, listIdentities, updateProfile, uploadAvatar } from '../../services/auth'
import { getBillingStatus } from '../../services/billing'
import { getEmailPreferences } from '../../services/emailPreferences'
import { Configuracoes } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../features/theme/ThemeContext', () => ({ useTheme: vi.fn() }))
vi.mock('../../services/auth', () => ({
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    listIdentities: vi.fn(),
    uploadAvatar: vi.fn(),
}))

vi.mock('../../services/billing', () => ({ getBillingStatus: vi.fn(), reportFunnelEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../services/emailPreferences', () => ({
    getEmailPreferences: vi.fn(),
    updateEmailPreferences: vi.fn(),
}))

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([{ path: '/configuracoes', element: <Configuracoes /> }], { initialEntries: ['/configuracoes'] })
    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('Configuracoes (tela 9.2)', () => {
    const setUser = vi.fn()
    const setTheme = vi.fn()

    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true, avatarUrl: null },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser,
        })
        vi.mocked(useTheme).mockReturnValue({ theme: 'dark', setTheme })
        vi.mocked(getBillingStatus).mockResolvedValue({
            isPro: false,
            state: 'none',
            plan: null,
            store: null,
            expiresAt: null,
            willRenew: false,
            managementUrl: null,
            billingEnabled: false,
        })
        vi.mocked(getEmailPreferences).mockResolvedValue({ preferences: { social: false, engagement: false }, suppression: null })
        vi.mocked(listIdentities).mockResolvedValue({
            identities: [{ id: 'i1', userId: 'u1', providerName: 'google', providerAccountId: 'g1' }],
        })
    })

    afterEach(() => vi.clearAllMocks())

    it('mostra os dados atuais e os provedores conectados', async () => {
        renderPage()

        expect(screen.getByDisplayValue('Ana')).toBeInTheDocument()
        expect(screen.getByDisplayValue('ana@x.com')).toBeInTheDocument()
        expect(await screen.findByText('Google')).toBeInTheDocument()
    })

    it('traz a seção de preferências de e-mail com tudo desligado (EM.6.1)', async () => {
        renderPage()

        expect(await screen.findByRole('checkbox', { name: /Amigos/ })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: /Resumo e lembretes/ })).not.toBeChecked()
    })

    it('e-mail é somente leitura (6.10.4)', () => {
        renderPage()

        expect(screen.getByDisplayValue('ana@x.com')).toBeDisabled()
    })

    it('alterna o tema claro/escuro (6.10.7)', () => {
        renderPage()

        expect(screen.getByRole('radio', { name: /Escuro/ })).toHaveAttribute('aria-checked', 'true')
        fireEvent.click(screen.getByRole('radio', { name: /Claro/ }))

        expect(setTheme).toHaveBeenCalledWith('light')
    })

    it('salva os dados cadastrais com sucesso e atualiza o usuário', async () => {
        const updatedUser = {
            id: 'u1',
            name: 'Ana Paula',
            email: 'ana@x.com',
            username: 'ana',
            role: 'user' as const,
            onboardingCompleted: true,
            avatarUrl: null,
        }
        vi.mocked(updateProfile).mockResolvedValue({ user: updatedUser })

        renderPage()
        fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Paula' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0])

        await waitFor(() => expect(updateProfile).toHaveBeenCalledWith('token', { name: 'Ana Paula', username: 'ana' }))
        expect(await screen.findByText('Perfil atualizado.')).toBeInTheDocument()
        expect(setUser).toHaveBeenCalledWith(updatedUser)
    })

    it('conflito de e-mail/username (409) mostra a mensagem do backend', async () => {
        vi.mocked(updateProfile).mockRejectedValue(new ApiError(409, 'username já em uso'))

        renderPage()
        fireEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0])

        expect(await screen.findByText('username já em uso')).toBeInTheDocument()
    })

    it('senha atual incorreta (401) mostra a mensagem do backend', async () => {
        vi.mocked(changePassword).mockRejectedValue(new ApiError(401, 'senha atual incorreta'))

        renderPage()
        fireEvent.change(screen.getByLabelText('Senha atual'), { target: { value: 'errada123' } })
        fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novaSenha123' } })
        fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'novaSenha123' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[1])

        expect(await screen.findByText('senha atual incorreta')).toBeInTheDocument()
    })

    it('senhas diferentes bloqueiam o envio antes de chamar a API', async () => {
        renderPage()
        fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novaSenha123' } })
        fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'outraSenha456' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[1])

        expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
        expect(changePassword).not.toHaveBeenCalled()
    })

    it('envia a foto de perfil e atualiza o usuário (6.10.8)', async () => {
        const updatedUser = {
            id: 'u1',
            name: 'Ana',
            email: 'ana@x.com',
            username: 'ana',
            role: 'user' as const,
            onboardingCompleted: true,
            avatarUrl: '/avatars/u1-abc.jpg',
        }
        vi.mocked(uploadAvatar).mockResolvedValue({ user: updatedUser })
        const file = new File(['fake-bytes'], 'foto.jpg', { type: 'image/jpeg' })

        renderPage()
        fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [file] } })

        await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith('token', file))
        expect(setUser).toHaveBeenCalledWith(updatedUser)
    })

    it('rejeita tipo de arquivo não suportado antes de chamar a API (6.10.8)', async () => {
        const file = new File(['fake-bytes'], 'foto.gif', { type: 'image/gif' })

        renderPage()
        fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [file] } })

        expect(await screen.findByText('Tipo de arquivo não suportado. Use JPEG, PNG ou WEBP.')).toBeInTheDocument()
        expect(uploadAvatar).not.toHaveBeenCalled()
    })

    it('rejeita arquivo maior que 5MB antes de chamar a API (6.10.8)', async () => {
        const bigFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' })

        renderPage()
        fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [bigFile] } })

        expect(await screen.findByText('Arquivo maior que o limite de 5MB.')).toBeInTheDocument()
        expect(uploadAvatar).not.toHaveBeenCalled()
    })

    it('erro do backend ao enviar a foto mostra a mensagem inline', async () => {
        vi.mocked(uploadAvatar).mockRejectedValue(new ApiError(400, 'tipo de arquivo não suportado (use JPEG, PNG ou WEBP)'))
        const file = new File(['fake-bytes'], 'foto.jpg', { type: 'image/jpeg' })

        renderPage()
        fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [file] } })

        expect(await screen.findByText('tipo de arquivo não suportado (use JPEG, PNG ou WEBP)')).toBeInTheDocument()
    })
})
