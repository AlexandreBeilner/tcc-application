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
        expect(screen.getByText('R$ 300,00')).toBeInTheDocument()
    })

    it('mostra o valor total (unit_value já é o total) quando o evento não tem quantidade', () => {
        render(
            <StatementList events={[{ id: 'e1', event_type: 'initial_deposit', unit_value: 10000, timestamp: '2026-01-01T12:00:00Z' }]} />,
        )
        expect(screen.getByText('R$ 10.000,00')).toBeInTheDocument()
    })

    it('mostra ativo e quantidade só quando presentes no evento', () => {
        render(
            <StatementList events={[{ id: 'e1', event_type: 'initial_deposit', unit_value: 10000, timestamp: '2026-01-01T12:00:00Z' }]} />,
        )
        expect(screen.getByText('Depósito inicial')).toBeInTheDocument()
        expect(screen.queryByText('Ativo')).not.toBeInTheDocument()
        expect(screen.queryByText('Quantidade')).not.toBeInTheDocument()
    })

    it('resolve asset_id via assetLabels em vez de mostrar o UUID cru', () => {
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
                assetLabels={{ a1: 'PETR4 · Petrobras' }}
            />,
        )
        expect(screen.getByText('PETR4 · Petrobras')).toBeInTheDocument()
        expect(screen.queryByText('a1')).not.toBeInTheDocument()
    })

    it('sem assetLabels (ou id sem correspondência), cai de volta pro UUID cru', () => {
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
        expect(screen.getByText('a1')).toBeInTheDocument()
    })
})
