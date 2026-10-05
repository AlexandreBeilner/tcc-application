import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompoundGrowthWidget } from '.'

const props = { initial: 1000, monthly: 0, ratePct: 12, rateUnit: 'year' as const, months: 24, showSimple: true }

describe('CompoundGrowthWidget', () => {
    it('calcula o valor final composto e compara com juros simples', () => {
        render(<CompoundGrowthWidget {...props} />)

        expect(screen.getByText(/Valor final/)).toHaveTextContent('R$ 1.254,40')
        expect(screen.getByText(/Com juros simples/)).toHaveTextContent('R$ 1.240,00')
    })

    it('mover o prazo recalcula', () => {
        render(<CompoundGrowthWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Prazo/), { target: { value: '12' } })

        expect(screen.getByText(/Valor final/)).toHaveTextContent('R$ 1.120,00')
    })

    it('sem showSimple não mostra o comparativo', () => {
        render(<CompoundGrowthWidget {...props} showSimple={false} />)

        expect(screen.queryByText(/Com juros simples/)).not.toBeInTheDocument()
    })
})
