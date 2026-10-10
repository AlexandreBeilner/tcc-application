import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../features/auth/AuthContext'
import { AuthCallback } from '.'

vi.mock('../../features/auth/AuthContext', () => ({
    useAuth: vi.fn(),
}))

// <MemoryRouter> não sincroniza com `window.location` de verdade (por
// isso `createBrowserRouter` em produção) — o token precisa ser colocado
// no `window.location.hash` real, separado do path usado pelo router de
// teste.
function renderCallback() {
    const router = createMemoryRouter(
        [
            { path: '/auth/callback', element: <AuthCallback /> },
            { path: '/', element: <div>tela protegida</div> },
        ],
        { initialEntries: ['/auth/callback'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('AuthCallback', () => {
    afterEach(() => {
        vi.clearAllMocks()
        window.location.hash = ''
    })

    it('lê o token do fragment da URL, chama login e navega pra "/"', async () => {
        window.location.hash = '#token=jwt-google-123'
        const authLogin = vi.fn()
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: authLogin,
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderCallback()

        await waitFor(() => expect(authLogin).toHaveBeenCalledWith('jwt-google-123'))
        await waitFor(() => expect(screen.getByText('tela protegida')).toBeInTheDocument())
    })

    it('login com Google de conta suspensa mostra a mensagem própria e não chama login', async () => {
        window.location.hash = '#error=account_suspended'
        const authLogin = vi.fn()
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: authLogin,
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderCallback()

        expect(await screen.findByText(/Sua conta está suspensa/)).toBeInTheDocument()
        expect(authLogin).not.toHaveBeenCalled()
    })

    it('sem token no fragment, mostra erro e não chama login', async () => {
        const authLogin = vi.fn()
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: authLogin,
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderCallback()

        await waitFor(() => expect(screen.getByText('Não foi possível concluir o login com Google.')).toBeInTheDocument())
        expect(authLogin).not.toHaveBeenCalled()
    })

    it('Google sem e-mail verificado numa conta existente mostra a mensagem própria e não chama login (EM.3.2)', async () => {
        window.location.hash = '#error=google_email_not_verified'
        const authLogin = vi.fn()
        vi.mocked(useAuth).mockReturnValue({
            token: null,
            user: null,
            isLoading: false,
            login: authLogin,
            logout: vi.fn(),
            setUser: vi.fn(),
        })

        renderCallback()

        expect(await screen.findByText(/O Google não confirmou o seu e-mail/)).toBeInTheDocument()
        expect(authLogin).not.toHaveBeenCalled()
    })
})
