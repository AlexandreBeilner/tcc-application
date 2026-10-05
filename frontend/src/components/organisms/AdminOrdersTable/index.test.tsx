import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AdminOrder } from '../../../services/admin'
import { AdminOrdersTable } from '.'

const open: AdminOrder = {
    order_id: 'o1',
    asset_id: 'a1',
    ticker: 'ACME3',
    user_id: '1d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a33',
    is_bot: true,
    bot_archetype: 'market_maker',
    side: 'sell',
    type: 'limit',
    quantity: 100,
    filled_quantity: 20,
    price: 22.2,
    status: 'partially_filled',
    cancel_reason: null,
    simulated_day: 7,
    created_at: '2026-10-03T12:00:00Z',
}
const cancelled: AdminOrder = { ...open, order_id: 'o2', status: 'cancelled', cancel_reason: 'admin', is_bot: false, bot_archetype: null }

function renderTable(orders: AdminOrder[], onCancel = vi.fn(), cancellingId: string | null = null) {
    render(
        <MemoryRouter>
            <AdminOrdersTable orders={orders} cancellingId={cancellingId} onCancel={onCancel} emptyMessage="Nenhuma ordem." />
        </MemoryRouter>,
    )
    return onCancel
}

describe('AdminOrdersTable', () => {
    it('mostra a mensagem vazia sem ordens', () => {
        renderTable([])
        expect(screen.getByText('Nenhuma ordem.')).toBeInTheDocument()
    })

    it('mostra dono, quantidade executada e status com texto', () => {
        renderTable([open])
        const table = screen.getByRole('table')
        expect(within(table).getByText('Bot (Market Maker)')).toBeInTheDocument()
        expect(within(table).getByText('20 / 100')).toBeInTheDocument()
        expect(within(table).getByText('Parcial')).toBeInTheDocument()
        expect(within(table).getByRole('link', { name: 'ACME3' })).toHaveAttribute('href', '/admin/mercado/ativos/a1')
    })

    it('só ordem em repouso tem Cancelar, e o botão repassa a ordem', () => {
        const onCancel = renderTable([open, cancelled])
        const table = screen.getByRole('table')
        const buttons = within(table).getAllByRole('button', { name: 'Cancelar' })
        expect(buttons).toHaveLength(1)
        fireEvent.click(buttons[0])
        expect(onCancel).toHaveBeenCalledWith(open)
        expect(within(table).getByText('Cancelada, por intervenção do admin')).toBeInTheDocument()
    })

    it('trava só o botão da ordem em cancelamento', () => {
        renderTable([open], vi.fn(), 'o1')
        expect(within(screen.getByRole('table')).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    })
})
