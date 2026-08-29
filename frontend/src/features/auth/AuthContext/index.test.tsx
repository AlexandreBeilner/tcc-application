import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser } from '../../../services/auth'
import { ApiError } from '../../../services/client'
import { AuthProvider, useAuth } from '.'

vi.mock('../../../services/auth', () => ({
    getCurrentUser: vi.fn(),
}))

const TOKEN_STORAGE_KEY = 'tcc.auth.token'

function Consumer() {
    const { token, user, isLoading, login, logout } = useAuth()
    return (
        <div>
            <span data-testid="loading">{String(isLoading)}</span>
            <span data-testid="token">{token ?? 'sem-token'}</span>
            <span data-testid="user">{user?.username ?? 'sem-usuario'}</span>
            <button onClick={() => login('novo-token')}>login</button>
            <button
                onClick={() =>
                    login('token-bia', {
                        id: '2',
                        name: 'Bia',
                        email: 'bia@example.com',
                        username: 'bia',
                        role: 'user',
                        onboardingCompleted: true,
                    })
                }
            >
                login-com-usuario
            </button>
            <button onClick={() => logout()}>logout</button>
        </div>
    )
}

describe('AuthContext', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('sem token salvo, não fica carregando e não chama GET /auth/me', async () => {
        render(
            <AuthProvider>
                <Consumer />
            </AuthProvider>,
        )

        expect(screen.getByTestId('loading').textContent).toBe('false')
        expect(screen.getByTestId('token').textContent).toBe('sem-token')
        expect(getCurrentUser).not.toHaveBeenCalled()
    })

    it('login persiste o token no localStorage e carrega o usuário via GET /auth/me', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({
            user: {
                id: '1',
                name: 'Ana',
                email: 'ana@example.com',
                username: 'ana',
                role: 'user',
                onboardingCompleted: true,
            },
        })

        render(
            <AuthProvider>
                <Consumer />
            </AuthProvider>,
        )

        act(() => {
            screen.getByText('login').click()
        })

        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('novo-token')

        await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('ana'))
    })

    it('token inválido (GET /auth/me responde 401) desloga e limpa o localStorage', async () => {
        localStorage.setItem(TOKEN_STORAGE_KEY, 'token-expirado')
        vi.mocked(getCurrentUser).mockRejectedValue(new ApiError(401, 'token inválido'))

        render(
            <AuthProvider>
                <Consumer />
            </AuthProvider>,
        )

        await waitFor(() => expect(screen.getByTestId('token').textContent).toBe('sem-token'))
        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    })

    it('erro transitório (GET /auth/me fora do ar) não desloga o usuário', async () => {
        localStorage.setItem(TOKEN_STORAGE_KEY, 'token-valido')
        vi.mocked(getCurrentUser).mockRejectedValue(new ApiError(503, 'indisponível'))

        render(
            <AuthProvider>
                <Consumer />
            </AuthProvider>,
        )

        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
        expect(screen.getByTestId('token').textContent).toBe('token-valido')
        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('token-valido')
    })

    it('login com usuário já conhecido aplica direto, sem chamar GET /auth/me', async () => {
        render(
            <AuthProvider>
                <Consumer />
            </AuthProvider>,
        )

        act(() => {
            screen.getByText('login-com-usuario').click()
        })

        expect(screen.getByTestId('user').textContent).toBe('bia')
        expect(screen.getByTestId('loading').textContent).toBe('false')
        expect(getCurrentUser).not.toHaveBeenCalled()
    })

    it('logout limpa token, usuário e localStorage', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue({
            user: {
                id: '1',
                name: 'Ana',
                email: 'ana@example.com',
                username: 'ana',
                role: 'user',
                onboardingCompleted: true,
            },
        })

        render(
            <AuthProvider>
                <Consumer />
            </AuthProvider>,
        )

        act(() => {
            screen.getByText('login').click()
        })
        await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('ana'))

        act(() => {
            screen.getByText('logout').click()
        })

        expect(screen.getByTestId('token').textContent).toBe('sem-token')
        expect(screen.getByTestId('user').textContent).toBe('sem-usuario')
        expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    })
})
