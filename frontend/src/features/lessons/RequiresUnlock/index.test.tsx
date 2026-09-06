import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useUnlockedKeys } from '../useUnlockedKeys'
import { RequiresUnlock } from '.'

vi.mock('../useUnlockedKeys', () => ({ useUnlockedKeys: vi.fn() }))

function renderWithRouter(unlockKey: string) {
    const router = createMemoryRouter(
        [
            { path: '/trilha', element: <div>mapa da trilha</div> },
            {
                element: <RequiresUnlock unlockKey={unlockKey} />,
                children: [{ path: '/', element: <div>portfolio</div> }],
            },
        ],
        { initialEntries: ['/'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('RequiresUnlock', () => {
    it('sem a chave desbloqueada, redireciona pra /trilha', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: false })

        renderWithRouter('portfolio')

        expect(screen.getByText('mapa da trilha')).toBeInTheDocument()
    })

    it('com a chave desbloqueada, renderiza a rota protegida', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(['portfolio']),
            lessons: [],
            isLoading: false,
            isError: false,
        })

        renderWithRouter('portfolio')

        expect(screen.getByText('portfolio')).toBeInTheDocument()
    })

    it('enquanto carrega, não redireciona nem renderiza a rota', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: true, isError: false })

        renderWithRouter('portfolio')

        expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
        expect(screen.queryByText('mapa da trilha')).not.toBeInTheDocument()
    })

    it('numa falha transitória de GET /lessons, não redireciona um usuário que pode já ter desbloqueado a chave', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false, isError: true })

        renderWithRouter('portfolio')

        expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
        expect(screen.queryByText('mapa da trilha')).not.toBeInTheDocument()
    })
})
