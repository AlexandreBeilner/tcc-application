import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmergencyFundCalculatorWidget, emergencyFundCalculatorSummary } from '.'

const props = { monthlyCost: 3000, incomeType: 'stable' as const, monthlyContribution: 500 }

describe('EmergencyFundCalculatorWidget', () => {
    it('mostra a meta de 3 a 6 meses e o prazo de aporte', () => {
        render(<EmergencyFundCalculatorWidget {...props} />)

        expect(screen.getByText(/Meta: R\$ 9\.000,00 a R\$ 18\.000,00/)).toBeInTheDocument()
        expect(screen.getByText(/em 18 meses/)).toBeInTheDocument()
    })

    it('renda variável dobra a faixa', () => {
        render(<EmergencyFundCalculatorWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /Renda variável/ }))

        expect(screen.getByText(/Meta: R\$ 18\.000,00 a R\$ 36\.000,00/)).toBeInTheDocument()
    })

    it('sem aporte pede o valor em vez de um prazo', () => {
        render(<EmergencyFundCalculatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Quanto você consegue guardar/), { target: { value: '0' } })

        expect(screen.getByText(/Informe quanto consegue guardar/)).toBeInTheDocument()
    })

    it('o resumo descreve a meta', () => {
        expect(emergencyFundCalculatorSummary(props)).toMatch(/R\$\s9\.000,00 a R\$\s18\.000,00/)
    })
})
