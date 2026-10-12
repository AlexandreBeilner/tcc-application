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

    it('declara que os dados são simulados, que o app não tem analytics de terceiros e que o site de apresentação mede visitas sem cookies', () => {
        renderPage()

        expect(screen.getByText(/simulações com dinheiro fictício/)).toBeInTheDocument()
        expect(screen.getByText(/No aplicativo, não usamos cookies de rastreamento/)).toBeInTheDocument()
        expect(screen.getByText(/Cloudflare Web Analytics.*Ele não usa cookies/)).toBeInTheDocument()
    })

    it('o link de voltar leva ao login', () => {
        renderPage()

        expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/login')
    })

    it('cita a hospedagem na Vultr, em São Paulo, e as cópias de segurança (sem placeholder pendente)', () => {
        renderPage()
        expect(screen.getByText(/Com o provedor de hospedagem \(Vultr\)/)).toBeInTheDocument()
        expect(screen.getByText(/Com o provedor das cópias de segurança/)).toBeInTheDocument()
        expect(document.body.textContent).not.toContain('[PREENCHER')
    })
})
