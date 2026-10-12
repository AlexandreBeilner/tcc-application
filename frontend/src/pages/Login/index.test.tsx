import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../services/client'
import { googleLoginUrl, login, register, resendVerification } from '../../services/auth'
import { useAuth } from '../../features/auth/AuthContext'
import { Login } from '.'

vi.mock('../../services/auth', () => ({
    googleLoginUrl: vi.fn(() => '/auth/google'),
    login: vi.fn(),
    register: vi.fn(),
    resendVerification: vi.fn(),
}))

vi.mock('../../features/auth/AuthContext', () => ({
    useAuth: vi.fn(),
}))

function renderLogin(entry = '/login') {
    const router = createMemoryRouter(
        [
            { path: '/login', element: <Login /> },
            { path: '/', element: <div>tela protegida</div> },
        ],
        { initialEntries: [entry] },
    )
    return render(<RouterProvider router={router} />)
}

describe('Login (tela 1.1)', () => {
    afterEach(() => {
        vi.clearAllMocks()
        sessionStorage.clear()
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

    it('login mostra o link "Esqueci minha senha"; cadastro não', () => {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderLogin()
        expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/esqueci-senha')

        fireEvent.click(screen.getByText('Não tem conta? Cadastre-se'))
        expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).not.toBeInTheDocument()
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
                avatarUrl: null,
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
                avatarUrl: null,
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

    it('conta suspensa (403 account_suspended) mostra a mensagem própria, sem navegar', async () => {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(login).mockRejectedValue(new ApiError(403, 'account_suspended'))

        renderLogin()
        fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-forte-123' } })
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

        await waitFor(() =>
            expect(screen.getByRole('alert').textContent).toBe(
                'Sua conta está suspensa. Fale com o suporte (suporte@selucra.com.br) para entender o motivo.',
            ),
        )
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
        fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'senha1234' } })
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

        await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('username já em uso'))
    })

    it('cadastro com "Confirmar senha" diferente bloqueia o envio antes de chamar a API (6.10.6)', async () => {
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
        fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
        fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
        fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'ana' } })
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } })
        fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'outraSenha456' } })
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

        expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
        expect(register).not.toHaveBeenCalled()
    })

    it('cadastro mostra o indicador de força da senha, login não (6.10.6)', () => {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderLogin()
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'ab' } })
        expect(screen.queryByText(/Força da senha/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByText('Não tem conta? Cadastre-se'))
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'abcdefgh' } })
        expect(screen.getByText('Força da senha: Fraca')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Abcdefghijkl1!' } })
        expect(screen.getByText('Força da senha: Forte')).toBeInTheDocument()
    })

    function mockLoggedOut() {
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: vi.fn(),
            logout: vi.fn(),
            setUser: vi.fn(),
        })
    }

    it('cadastro não cria sessão: mostra o aviso "enviamos um link" com o reenvio à mão (EM.3.3)', async () => {
        const authLogin = vi.fn()
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: authLogin,
            logout: vi.fn(),
            setUser: vi.fn(),
        })
        vi.mocked(register).mockResolvedValue({
            user: {
                id: '1',
                name: 'Ana',
                email: 'ana@example.com',
                username: 'ana',
                role: 'user',
                onboardingCompleted: false,
                avatarUrl: null,
            },
            emailVerificationRequired: true,
        })
        vi.mocked(resendVerification).mockResolvedValue({ message: 'ok' })

        renderLogin()
        fireEvent.click(screen.getByText('Não tem conta? Cadastre-se'))
        fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
        fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
        fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'ana' } })
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } })
        fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'senha1234' } })
        fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

        expect(await screen.findByText('Enviamos um link para ana@example.com')).toBeInTheDocument()
        expect(authLogin).not.toHaveBeenCalled()
        expect(screen.queryByText('tela protegida')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }))
        await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('ana@example.com'))

        fireEvent.click(screen.getByRole('button', { name: 'Já confirmei, quero entrar' }))
        expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    })

    it('login de conta não verificada (403 email_not_verified) mostra o aviso e o reenvio, sem navegar (EM.3.3)', async () => {
        mockLoggedOut()
        vi.mocked(login).mockRejectedValue(new ApiError(403, 'email_not_verified'))
        vi.mocked(resendVerification).mockResolvedValue({ message: 'ok' })

        renderLogin()
        fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } })
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

        expect(await screen.findByText('Falta confirmar seu e-mail')).toBeInTheDocument()
        expect(screen.queryByText('tela protegida')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Reenviar e-mail de confirmação' }))
        await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('ana@example.com'))
    })

    describe('convite por link (MO.7.2)', () => {
        function mockLoggedOutUser() {
            vi.mocked(useAuth).mockReturnValue({
                token: null,
                user: null,
                isLoading: false,
                login: vi.fn(),
                logout: vi.fn(),
                setUser: vi.fn(),
            })
        }

        it('abre direto no cadastro e leva o código no cadastro e no link do Google', async () => {
            mockLoggedOutUser()
            vi.mocked(register).mockResolvedValue({
                user: {
                    id: '1',
                    name: 'Ana',
                    email: 'ana@example.com',
                    username: 'ana',
                    role: 'user',
                    onboardingCompleted: false,
                    avatarUrl: null,
                },
                emailVerificationRequired: true,
            })

            renderLogin('/login?ref=abcd2345')

            expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument()
            expect(googleLoginUrl).toHaveBeenCalledWith('ABCD2345')

            fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
            fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
            fireEvent.change(screen.getByLabelText('Nome de usuário'), { target: { value: 'ana' } })
            fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha1234' } })
            fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'senha1234' } })
            fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

            await waitFor(() =>
                expect(register).toHaveBeenCalledWith({
                    name: 'Ana',
                    email: 'ana@example.com',
                    username: 'ana',
                    password: 'senha1234',
                    referralCode: 'ABCD2345',
                }),
            )
        })

        it('`?modo=cadastro` (botão "Criar conta" da landing) abre direto no cadastro', () => {
            mockLoggedOutUser()
            renderLogin('/login?modo=cadastro')
            expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument()
            expect(screen.getByLabelText('Confirmar senha')).toBeInTheDocument()
        })

        it('outro valor de `modo` é ignorado e a tela abre em login', () => {
            mockLoggedOutUser()
            renderLogin('/login?modo=outro')
            expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
        })

        it('código de formato inválido é ignorado e a tela abre em login', () => {
            mockLoggedOutUser()
            renderLogin('/login?ref=curto')
            expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
            expect(googleLoginUrl).toHaveBeenCalledWith(null)
        })
    })
})
