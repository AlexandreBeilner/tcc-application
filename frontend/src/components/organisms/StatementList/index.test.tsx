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
        // compra é saída: valor com sinal − e seta para baixo (MO.9.4)
        expect(screen.getByLabelText('saída de R$ 300,00')).toHaveTextContent('−R$ 300,00')
    })

    it('evento de ativo do Modo Aprendizado mostra o valor neutro, sem seta de caixa (ponto 063)', () => {
        render(
            <StatementList
                events={[
                    {
                        id: 'e1',
                        event_type: 'buy_order_executed',
                        asset_id: 'sand',
                        quantity: 5,
                        unit_value: 100,
                        timestamp: '2026-01-01T12:00:00Z',
                    },
                ]}
                sandboxAssetIds={new Set(['sand'])}
            />,
        )
        expect(screen.getByText('Modo Aprendizado')).toBeInTheDocument()
        expect(screen.queryByLabelText('saída de R$ 500,00')).not.toBeInTheDocument()
        expect(screen.getByText('R$ 500,00')).toBeInTheDocument()
    })

    it('mostra o valor total (unit_value já é o total) quando o evento não tem quantidade', () => {
        render(
            <StatementList events={[{ id: 'e1', event_type: 'initial_deposit', unit_value: 10000, timestamp: '2026-01-01T12:00:00Z' }]} />,
        )
        expect(screen.getByLabelText('entrada de R$ 10.000,00')).toHaveTextContent('+R$ 10.000,00')
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

    it('salário e crédito do administrador têm rótulo em português e entram como entrada', () => {
        render(
            <StatementList
                events={[
                    { id: 's', event_type: 'salary_payment', unit_value: 200, timestamp: '2026-01-01T12:00:00Z' },
                    { id: 'c', event_type: 'admin_credit', unit_value: 500, timestamp: '2026-01-02T12:00:00Z' },
                ]}
            />,
        )
        expect(screen.getByText('Salário')).toBeInTheDocument()
        expect(screen.getByText('Crédito do administrador')).toBeInTheDocument()
        expect(screen.queryByText('salary_payment')).not.toBeInTheDocument()
        expect(screen.getByLabelText('entrada de R$ 200,00')).toBeInTheDocument()
    })
})
