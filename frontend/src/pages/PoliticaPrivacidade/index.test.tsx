import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PoliticaPrivacidade } from '.'

function renderPage() {
    const router = createMemoryRouter(
        [
            { path: '/privacidade', element: <PoliticaPrivacidade /> },
            { path: '/login', element: <p>tela de login</p> },
        ],
        { initialEntries: ['/privacidade'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('PoliticaPrivacidade (tarefa 4.2)', () => {
    it('renderiza sem login, com as seções exigidas pela LGPD', () => {
        renderPage()

        expect(screen.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeInTheDocument()
        for (const heading of [
            '1. Quem somos',
            '3. Dados que coletamos, para quê e em que base legal',
            '7. Por quanto tempo guardamos',
            '9. Seus direitos',
        ]) {
            expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
        }
    })

    it('declara que os dados de investimento são simulados e que não há analytics de terceiros', () => {
        renderPage()

        expect(screen.getByText(/simulações com dinheiro fictício/)).toBeInTheDocument()
        expect(screen.getByText(/Não usamos cookies de rastreamento/)).toBeInTheDocument()
    })

    it('o link de voltar leva ao login', () => {
        renderPage()

        expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/login')
    })
})
