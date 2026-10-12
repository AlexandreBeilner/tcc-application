import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { ApiError } from '../../services/client'
import { resetPassword } from '../../services/auth'
import { RedefinirSenha } from '.'

vi.mock('../../services/auth', () => ({
    resetPassword: vi.fn(),
}))

vi.mock('../../features/auth/AuthContext', () => ({
    useAuth: vi.fn(),
}))

// O token vem do `window.location.hash` real (o router de teste é em memória), como no
// AuthCallback.
function renderPage(hash: string | null = '#token=tok-123') {
    window.history.replaceState(null, '', `/redefinir-senha${hash ?? ''}`)
    const router = createMemoryRouter(
        [
            { path: '/redefinir-senha', element: <RedefinirSenha /> },
            { path: '/login', element: <div>tela de entrada</div> },
            { path: '/esqueci-senha', element: <div>tela de pedido</div> },
        ],
        { initialEntries: ['/redefinir-senha'] },
    )
    return render(<RouterProvider router={router} />)
}

function fill(password: string, confirm = password) {
    fireEvent.change(screen.getByLabelText('Senha nova'), { target: { value: password } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: confirm } })
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))
}

function mockAuth(logout = vi.fn()) {
    vi.mocked(useAuth).mockReturnValue({ token: null, user: null, isLoading: false, login: vi.fn(), logout, setUser: vi.fn() })
    return logout
}

describe('RedefinirSenha (EM.2.3)', () => {
    afterEach(() => {
        vi.clearAllMocks()
        window.history.replaceState(null, '', '/')
    })

    it('lê o token do fragmento, tira o fragmento da URL e envia a senha nova', async () => {
        const logout = mockAuth()
        vi.mocked(resetPassword).mockResolvedValue({ message: 'senha redefinida' })
        renderPage()

        expect(window.location.hash).toBe('')
        fill('senha-nova-123')

        expect(await screen.findByText('Pronto, sua senha foi alterada')).toBeInTheDocument()
        expect(resetPassword).toHaveBeenCalledWith({ token: 'tok-123', newPassword: 'senha-nova-123' })
        expect(logout).toHaveBeenCalled()
    })

    it('"Ir para a entrada" leva ao login', async () => {
        mockAuth()
        vi.mocked(resetPassword).mockResolvedValue({ message: 'ok' })
        renderPage()
        fill('senha-nova-123')

        fireEvent.click(await screen.findByRole('button', { name: 'Ir para a entrada' }))

        expect(await screen.findByText('tela de entrada')).toBeInTheDocument()
    })

    it('senhas diferentes: avisa e não chama a API', () => {
        mockAuth()
        renderPage()

        fill('senha-nova-123', 'outra-senha-123')

        expect(screen.getByRole('alert')).toHaveTextContent('As senhas não coincidem.')
        expect(resetPassword).not.toHaveBeenCalled()
    })

    it('sem token no fragmento: mostra link inválido e o caminho para pedir outro', async () => {
        mockAuth()
        renderPage(null)

        expect(screen.getByText('Este link não vale mais')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Pedir um novo link' }))

        expect(await screen.findByText('tela de pedido')).toBeInTheDocument()
    })

    it.each([401, 410])('API devolve %i: cai no estado de link inválido', async (status) => {
        mockAuth()
        vi.mocked(resetPassword).mockRejectedValue(new ApiError(status, 'token_expired'))
        renderPage()

        fill('senha-nova-123')

        expect(await screen.findByText('Este link não vale mais')).toBeInTheDocument()
    })

    it('429 mostra mensagem própria e mantém o formulário', async () => {
        mockAuth()
        vi.mocked(resetPassword).mockRejectedValue(new ApiError(429, 'muitas requisições, tente novamente em instantes'))
        renderPage()

        fill('senha-nova-123')

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Muitas tentativas'))
        expect(screen.getByLabelText('Senha nova')).toBeInTheDocument()
    })

    it('mostra o indicador de força ao digitar', () => {
        mockAuth()
        renderPage()

        fireEvent.change(screen.getByLabelText('Senha nova'), { target: { value: 'Abcdefgh1!xyz' } })

        expect(screen.getByText('Força da senha: Forte')).toBeInTheDocument()
    })
})
