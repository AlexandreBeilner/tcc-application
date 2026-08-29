import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatementList } from '.'

describe('StatementList', () => {
    it('mostra estado vazio sem transações', () => {
        render(<StatementList events={[]} />)
        expect(screen.getByText('Você ainda não tem nenhuma transação registrada.')).toBeInTheDocument()
    })

    it('traduz event_type pro rótulo em português', () => {
        render(
            <StatementList
                events={[
                    {
                        id: 'e1',
                        event_type: 'buy_order_executed',
                        asset_id: 'a1',
                        quantity: 10,
                        unit_value: 30,
                        timestamp: '2026-01-01T12:00:00Z',
                    },
                ]}
            />,
        )
        expect(screen.getByText('Compra executada')).toBeInTheDocument()
        expect(screen.getByText('R$ 30,00')).toBeInTheDocument()
    })

    it('mostra ativo e quantidade só quando presentes no evento', () => {
        render(
            <StatementList events={[{ id: 'e1', event_type: 'initial_deposit', unit_value: 10000, timestamp: '2026-01-01T12:00:00Z' }]} />,
        )
        expect(screen.getByText('Depósito inicial')).toBeInTheDocument()
        expect(screen.queryByText('Ativo')).not.toBeInTheDocument()
        expect(screen.queryByText('Quantidade')).not.toBeInTheDocument()
    })
})
