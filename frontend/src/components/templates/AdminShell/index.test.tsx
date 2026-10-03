import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AdminShell } from '.'

function renderShell(path = '/admin') {
    const router = createMemoryRouter(
        [
            {
                element: <AdminShell />,
                children: [
                    { path: '/admin', element: <div>conteúdo da visão geral</div> },
                    { path: '/admin/mercado', element: <div>conteúdo dos eventos</div> },
                ],
            },
        ],
        { initialEntries: [path] },
    )
    return render(<RouterProvider router={router} />)
}

describe('AdminShell (N.3)', () => {
    it('renderiza a navegação e a seção atual', () => {
        renderShell()
        expect(screen.getByRole('navigation', { name: 'Seções do painel administrativo' })).toBeInTheDocument()
        expect(screen.getByText('conteúdo da visão geral')).toBeInTheDocument()
    })

    it('navegar por uma seção troca só o conteúdo, mantendo o shell', () => {
        renderShell()
        fireEvent.click(screen.getByRole('link', { name: 'Mercado' }))
        expect(screen.getByText('conteúdo dos eventos')).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Seções do painel administrativo' })).toBeInTheDocument()
    })

    it('botão de menu abre a gaveta e Escape, o scrim e o link fecham', () => {
        renderShell()
        const toggle = screen.getByRole('button', { name: 'Menu do painel' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(toggle)
        fireEvent.click(screen.getByTestId('admin-scrim'))
        expect(toggle).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(toggle)
        fireEvent.click(screen.getByRole('link', { name: 'Mercado' }))
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })
})
