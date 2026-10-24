import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Termos } from '.'

function renderAt(path: string) {
    const router = createMemoryRouter(
        [
            { path: '/termos', element: <Termos /> },
            { path: '/privacidade', element: <p>privacidade</p> },
            { path: '/login', element: <p>login</p> },
        ],
        { initialEntries: [path] },
    )
    return render(<RouterProvider router={router} />)
}

describe('Termos de Uso (LW.4.2)', () => {
    it('renderiza sem login, diz que tudo é gratuito e não fala de plano pago', () => {
        renderAt('/termos')

        expect(screen.getByRole('heading', { level: 1, name: 'Termos de Uso' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: '6. Uso gratuito' })).toBeInTheDocument()
        expect(screen.getByText(/O Selucra é gratuito/)).toBeInTheDocument()
        expect(screen.queryAllByText(/\bPRO\b|[Rr]eembolso|[Rr]enovação automática/)).toHaveLength(0)
    })

    it('declara a idade mínima de 18 anos e o suporte', () => {
        renderAt('/termos')

        expect(screen.getByText(/maiores de 18 anos/)).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'suporte@selucra.com.br' }).length).toBeGreaterThan(0)
    })
})
