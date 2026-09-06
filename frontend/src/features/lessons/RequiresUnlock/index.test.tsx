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
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: false })

        renderWithRouter('portfolio')

        expect(screen.getByText('mapa da trilha')).toBeInTheDocument()
    })

    it('com a chave desbloqueada, renderiza a rota protegida', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({
            unlockedKeys: new Set(['portfolio']),
            lessons: [],
            isLoading: false,
        })

        renderWithRouter('portfolio')

        expect(screen.getByText('portfolio')).toBeInTheDocument()
    })

    it('enquanto carrega, não redireciona nem renderiza a rota', () => {
        vi.mocked(useUnlockedKeys).mockReturnValue({ unlockedKeys: new Set(), lessons: [], isLoading: true })

        renderWithRouter('portfolio')

        expect(screen.queryByText('portfolio')).not.toBeInTheDocument()
        expect(screen.queryByText('mapa da trilha')).not.toBeInTheDocument()
    })
})
