import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from './AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}))

function renderWithRouter() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <div>tela de login</div> },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/', element: <div>portfolio</div> }],
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ProtectedRoute', () => {
  it('sem token, redireciona para /login (tela 1.1)', () => {
    vi.mocked(useAuth).mockReturnValue({
      token: null,
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })

    renderWithRouter()

    expect(screen.getByText('tela de login')).toBeInTheDocument()
  })

  it('com token, renderiza a rota protegida', () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'valido',
      user: { id: '1', name: 'Ana', email: 'a@a.com', username: 'ana', role: 'user' },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    })

    renderWithRouter()

    expect(screen.getByText('portfolio')).toBeInTheDocument()
  })

  it('enquanto carrega o usuário, não redireciona nem renderiza a rota', () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'valido',
      user: null,
      isLoading: true,
      login: vi.fn(),
      logout: vi.fn(),
    })

    renderWithRouter()

    expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
    expect(screen.queryByText('tela de login')).not.toBeInTheDocument()
  })
})
