import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Reembolso } from '../Reembolso'
import { Termos } from '.'

function renderAt(path: string) {
    const router = createMemoryRouter(
        [
            { path: '/termos', element: <Termos /> },
            { path: '/reembolso', element: <Reembolso /> },
            { path: '/privacidade', element: <p>privacidade</p> },
            { path: '/login', element: <p>login</p> },
        ],
        { initialEntries: [path] },
    )
    return render(<RouterProvider router={router} />)
}

describe('Termos de Uso e da Assinatura PRO (LW.4.2)', () => {
    it('renderiza sem login com renovação, cancelamento, arrependimento e o que continua gratuito', () => {
        renderAt('/termos')

        expect(screen.getByRole('heading', { level: 1, name: 'Termos de Uso e da Assinatura PRO' })).toBeInTheDocument()
        for (const heading of ['8. Renovação automática', '9. Cancelamento', '10. Direito de arrependimento']) {
            expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
        }
        expect(screen.getByText(/nunca é necessário para aprender/)).toBeInTheDocument()
        expect(screen.getByText(/Cancelar nunca apaga o que você conquistou/)).toBeInTheDocument()
    })

    it('declara a idade mínima de 18 anos e o suporte', () => {
        renderAt('/termos')

        expect(screen.getByText(/maiores de 18 anos/)).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: 'suporte@selucra.com.br' }).length).toBeGreaterThan(0)
    })
})

describe('Política de Reembolso (LW.4.2)', () => {
    it('explica os 7 dias, o canal e o reembolso no mesmo cartão', () => {
        renderAt('/reembolso')

        expect(screen.getByRole('heading', { level: 1, name: 'Política de Reembolso' })).toBeInTheDocument()
        expect(screen.getAllByText(/7 dias corridos/).length).toBeGreaterThan(0)
        expect(screen.getByRole('link', { name: 'suporte@selucra.com.br' })).toHaveAttribute('href', 'mailto:suporte@selucra.com.br')
        expect(screen.getByText(/no mesmo cartão/)).toBeInTheDocument()
    })
})
