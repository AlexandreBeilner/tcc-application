import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PayOrInvestWidget, payOrInvestSummary } from '.'

const props = { amount: 1000, debtMonthlyPct: 5, investAnnualPct: 14, irPct: 15 }

describe('PayOrInvestWidget', () => {
    it('dívida cara pede quitar primeiro', () => {
        render(<PayOrInvestWidget {...props} />)
        expect(screen.getByText('Quitar a dívida primeiro costuma compensar.')).toBeInTheDocument()
        expect(screen.getByText(/A dívida custa 79,6% ao ano/)).toBeInTheDocument()
    })

    it('juros baixos da dívida deixam o investimento na frente', () => {
        render(<PayOrInvestWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Juros da dívida/), { target: { value: '0.5' } })
        expect(screen.getByText(/investimento rende mais/)).toBeInTheDocument()
    })

    it('o resumo textual descreve o comparador', () => {
        expect(payOrInvestSummary(props)).toMatch(/Comparador/)
    })
})
