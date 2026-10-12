import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { MyAccount } from '../../../services/market'
import { NetWorthCards } from '.'

function Where() {
    const location = useLocation()
    return <span data-testid="where">{location.pathname + location.search}</span>
}

function position(isSandbox: boolean, quantity = 1) {
    return { assetId: 'a', ticker: 'X', name: 'X', type: 'acao', isSandbox, quantity, averagePrice: 10, dividendsReceived: 0 }
}

function renderCards(positions: unknown[]) {
    const account = { cashBalance: 1000, positions, fixedIncomePositions: [] } as unknown as MyAccount
    return render(
        <MemoryRouter>
            <Routes>
                <Route path="/" element={<NetWorthCards account={account} />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('NetWorthCards', () => {
    it('sem posição Sandbox mostra só a dica de uma linha, sem faixa nem R$ 0,00 extra', () => {
        renderCards([position(false)])

        expect(screen.getByText(/Modo Aprendizado: pratique/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Ver meus ativos do modo aprendizado' })).not.toBeInTheDocument()
    })

    it('posição Sandbox zerada também não abre a faixa', () => {
        renderCards([position(true, 0)])

        expect(screen.queryByRole('button', { name: 'Ver meus ativos do modo aprendizado' })).not.toBeInTheDocument()
    })

    it('com posição Sandbox mostra a faixa e cada card vai para um destino diferente', () => {
        renderCards([position(false), position(true, 2)])

        expect(screen.getByText('Não conta pro ranking')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Ver meus ativos do modo aprendizado' }))
        expect(screen.getByTestId('where')).toHaveTextContent('/ativos?aba=aprendizado')
    })

    it('o card Mercado Ao Vivo leva a Meus ativos', () => {
        renderCards([position(false)])

        fireEvent.click(screen.getByLabelText('Ver meus ativos do mercado ao vivo'))
        expect(screen.getByTestId('where')).toHaveTextContent(/^\/ativos$/)
    })
})
