import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonitorBookPanel } from '.'

describe('MonitorBookPanel', () => {
    it('mostra os níveis com a parcela de bots e os últimos negócios', () => {
        render(
            <MonitorBookPanel
                asks={[{ price: 22.2, quantity: 100, bot_quantity: 100 }]}
                bids={[{ price: 21.8, quantity: 100, bot_quantity: 80 }]}
                trades={[{ simulated_day: 7, price: 22, quantity: 10, buyer_is_bot: false }]}
            />,
        )
        const bids = screen.getByRole('region', { name: 'Ordens de compra' })
        expect(within(bids).getByText('80')).toBeInTheDocument()
        const asks = screen.getByRole('region', { name: 'Ordens de venda' })
        expect(within(asks).getByText(/22,20/)).toBeInTheDocument()
        const trades = screen.getByRole('region', { name: 'Últimos negócios' })
        expect(within(trades).getByText('Usuário')).toBeInTheDocument()
    })

    it('book e negócios vazios mostram a mensagem de cada lado', () => {
        render(<MonitorBookPanel asks={[]} bids={[]} trades={[]} />)
        expect(screen.getByText('Ninguém vendendo agora.')).toBeInTheDocument()
        expect(screen.getByText('Ninguém comprando agora.')).toBeInTheDocument()
        expect(screen.getByText('Nenhum negócio ainda.')).toBeInTheDocument()
    })
})
