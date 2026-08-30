import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrderSummaryList } from '.'

describe('OrderSummaryList', () => {
    it('renderiza rótulo e valor de cada linha', () => {
        render(
            <OrderSummaryList
                rows={[
                    { label: 'Ativo', value: 'PETR4 · Petrobras' },
                    { label: 'Quantidade', value: '10' },
                    { label: 'Total', value: 'R$ 300,00', variant: 'total' },
                ]}
            />,
        )
        expect(screen.getByText('Ativo')).toBeInTheDocument()
        expect(screen.getByText('PETR4 · Petrobras')).toBeInTheDocument()
        expect(screen.getByText('Total')).toBeInTheDocument()
        expect(screen.getByText('R$ 300,00')).toBeInTheDocument()
    })

    it('não quebra com uma lista vazia de linhas', () => {
        const { container } = render(<OrderSummaryList rows={[]} />)
        expect(container.querySelectorAll('[class*="row"]').length).toBe(0)
    })
})
