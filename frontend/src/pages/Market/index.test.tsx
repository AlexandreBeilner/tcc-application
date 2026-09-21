import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Market } from '.'

function renderMarket() {
    const router = createMemoryRouter(
        [
            { path: '/mercado', element: <Market /> },
            { path: '/mercado/renda-fixa', element: <div>tela de renda fixa</div> },
            { path: '/mercado/renda-variavel', element: <div>tela de renda variável</div> },
            { path: '/mercado/indicadores', element: <div>tela de indicadores</div> },
            { path: '/mercado/ordens', element: <div>tela de minhas ordens</div> },
        ],
        { initialEntries: ['/mercado'] },
    )
    return render(<RouterProvider router={router} />)
}

describe('Market (tela 4.1)', () => {
    it('card Renda Fixa navega pra 4.2', () => {
        renderMarket()
        fireEvent.click(screen.getByText('Renda Fixa'))
        expect(screen.getByText('tela de renda fixa')).toBeInTheDocument()
    })

    it('card Renda Variável navega pra 4.4', () => {
        renderMarket()
        fireEvent.click(screen.getByText('Renda Variável'))
        expect(screen.getByText('tela de renda variável')).toBeInTheDocument()
    })

    it('card Indicadores Econômicos navega pra 4.9', () => {
        renderMarket()
        fireEvent.click(screen.getByText('Indicadores Econômicos'))
        expect(screen.getByText('tela de indicadores')).toBeInTheDocument()
    })

    it('card Minhas Ordens navega pra 4.10', () => {
        renderMarket()
        fireEvent.click(screen.getByText('Minhas Ordens'))
        expect(screen.getByText('tela de minhas ordens')).toBeInTheDocument()
    })
})
