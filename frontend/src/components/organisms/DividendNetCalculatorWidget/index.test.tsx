import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DividendNetCalculatorWidget, dividendNetCalculatorSummary } from '.'

const props = { quantity: 1000, valuePerShare: 1, kind: 'dividend' as const, otherSameMonth: 0 }

describe('DividendNetCalculatorWidget', () => {
    it('dividendo de R$ 1.000 abaixo do limite cai inteiro, sem retenção', () => {
        render(<DividendNetCalculatorWidget {...props} />)

        expect(screen.getByText(/Bruto R\$\s1\.000,00, retido R\$\s0,00 \(0%\), líquido R\$\s1\.000,00/)).toBeInTheDocument()
    })

    it('JCP retém 17,5%', () => {
        render(<DividendNetCalculatorWidget {...props} kind="jcp" />)

        expect(screen.getByText(/retido R\$\s175,00 \(17,5%\), líquido R\$\s825,00/)).toBeInTheDocument()
        expect(screen.getByText(/JCP \(juros sobre capital próprio\)/)).toBeInTheDocument()
    })

    it('outros proventos que levam o mês a mais de R$ 50 mil ativam os 10%', () => {
        render(<DividendNetCalculatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Outros proventos/), { target: { value: '60000' } })

        expect(screen.getByText(/retido R\$\s100,00 \(10%\)/)).toBeInTheDocument()
    })

    it('lucro apurado até 2025 desliga a retenção do dividendo', () => {
        render(<DividendNetCalculatorWidget {...props} otherSameMonth={60000} />)
        fireEvent.click(screen.getByRole('checkbox'))

        expect(screen.getByText(/retido R\$\s0,00/)).toBeInTheDocument()
        expect(screen.getByText(/isento, sem retenção/)).toBeInTheDocument()
    })

    it('o resumo cita o tipo', () => {
        expect(dividendNetCalculatorSummary({ ...props, kind: 'jcp' })).toMatch(/líquido de JCP/)
    })
})
