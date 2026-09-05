import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { ApiError } from '../../services/client'
import { changePassword, listIdentities, updateProfile } from '../../services/auth'
import { Configuracoes } from '.'

vi.mock('../../features/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../services/auth', () => ({ updateProfile: vi.fn(), changePassword: vi.fn(), listIdentities: vi.fn() }))

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

    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({
            token: 'token',
            user: { id: 'u1', name: 'Ana', email: 'ana@x.com', username: 'ana', role: 'user', onboardingCompleted: true },
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser,
        })
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

    it('salva os dados cadastrais com sucesso e atualiza o usuário', async () => {
        const updatedUser = {
            id: 'u1',
            name: 'Ana Paula',
            email: 'ana@x.com',
            username: 'ana',
            role: 'user' as const,
            onboardingCompleted: true,
        }
        vi.mocked(updateProfile).mockResolvedValue({ user: updatedUser })

        renderPage()
        fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Paula' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Salvar' })[0])

        await waitFor(() => expect(updateProfile).toHaveBeenCalledWith('token', { name: 'Ana Paula', email: 'ana@x.com', username: 'ana' }))
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
})
