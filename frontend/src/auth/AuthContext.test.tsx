import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser } from '../api/auth'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../api/auth', () => ({
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
      user: { id: '1', name: 'Ana', email: 'ana@example.com', username: 'ana', role: 'user' },
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

  it('token inválido (GET /auth/me falha) desloga e limpa o localStorage', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'token-expirado')
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('401'))

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('token').textContent).toBe('sem-token'))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('logout limpa token, usuário e localStorage', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      user: { id: '1', name: 'Ana', email: 'ana@example.com', username: 'ana', role: 'user' },
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
