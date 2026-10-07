import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BondPriceCalculatorWidget, bondPriceCalculatorSummary } from '.'

const props = { ratePct: 11.75, years: 2, amount: 10_000 }

describe('BondPriceCalculatorWidget', () => {
    it('2 anos a 11,75%: cada título custa R$ 800,76', () => {
        render(<BondPriceCalculatorWidget {...props} />)

        expect(screen.getByText(/Cada título custa R\$\s800,76 e paga R\$\s1\.000,00/)).toBeInTheDocument()
        expect(screen.getByText(/Deságio: R\$\s199,24/)).toBeInTheDocument()
    })

    it('prazo maior com a mesma taxa baixa o preço', () => {
        render(<BondPriceCalculatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Prazo:/), { target: { value: '5' } })

        expect(screen.getByText(/Cada título custa R\$\s573,80/)).toBeInTheDocument()
    })

    it('mostra IR e custódia antes do líquido', () => {
        render(<BondPriceCalculatorWidget {...props} />)

        expect(screen.getByText(/Imposto de renda \(15%\)/)).toBeInTheDocument()
        expect(screen.getByText(/Ganho líquido:/)).toBeInTheDocument()
    })

    it('o resumo cita taxa e prazo', () => {
        expect(bondPriceCalculatorSummary(props)).toMatch(/11,75% ao ano, 2,00 anos/)
    })
})
