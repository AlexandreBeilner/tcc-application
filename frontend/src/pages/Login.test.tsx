import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../services/client'
import { googleLoginUrl, login, register } from '../services/auth'
import { useAuth } from '../features/auth/AuthContext'
import { Login } from './Login'

vi.mock('../services/auth', () => ({
    googleLoginUrl: vi.fn(() => '/auth/google'),
    login: vi.fn(),
    register: vi.fn(),
}))

vi.mock('../features/auth/AuthContext', () => ({
    useAuth: vi.fn(),
}))

function renderLogin() {
    const router = createMemoryRouter(
        [
            { path: '/login', element: <Login /> },
            { path: '/', element: <div>tela protegida</div> },
        ],
        { initialEntries: ['/login'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('Login (tela 1.1)', () => {
    afterEach(() => {
        vi.clearAllMocks()
    })

    it('modo padrão é login: só e-mail e senha, mais o link do Google', () => {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderLogin()

        expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
        expect(screen.getByLabelText('Senha')).toBeInTheDocument()
        expect(screen.queryByLabelText('Nome de usuário')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Entrar com Google' })).toHaveAttribute('href', '/auth/google')
        expect(googleLoginUrl).toHaveBeenCalled()
    })

    it('toggle troca pro modo cadastro, com nome e username extra', () => {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderLogin()
        fireEvent.click(screen.getByText('Não tem conta? Cadastre-se'))

        expect(screen.getByLabelText('Nome')).toBeInTheDocument()
        expect(screen.getByLabelText('Nome de usuário')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument()
    })

    it('login bem-sucedido chama AuthContext.login e navega pra "/"', async () => {
        const authLogin = vi.fn()
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: authLogin,
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(login).mockResolvedValue({
            token: 'jwt-123',
            user: {
                id: '1',
                name: 'Ana',
                email: 'ana@example.com',
                username: 'ana',
                role: 'user',
                onboardingCompleted: true,
            },
        })

        renderLogin()
        fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } })
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

        await waitFor(() =>
            expect(authLogin).toHaveBeenCalledWith('jwt-123', {
                id: '1',
                name: 'Ana',
                email: 'ana@example.com',
                username: 'ana',
                role: 'user',
                onboardingCompleted: true,
            }),
        )
        await waitFor(() => expect(screen.getByText('tela protegida')).toBeInTheDocument())
    })

    it('credencial inválida (401) mostra erro inline, sem navegar', async () => {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(login).mockRejectedValue(new ApiError(401, 'credenciais inválidas'))

        renderLogin()
        fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada12' } })
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

        await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('credenciais inválidas'))
        expect(screen.queryByText('tela protegida')).not.toBeInTheDocument()
    })

    it('e-mail e username já em uso no cadastro (409) mostram mensagens distintas do backend', async () => {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(register).mockRejectedValue(new ApiError(409, 'username já em uso'))

        renderLogin()
        fireEvent.click(screen.getByText('Não tem conta? Cadastre-se'))
        fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
        fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
        fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'ana' } })
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } })
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

        await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('username já em uso'))
    })
})
