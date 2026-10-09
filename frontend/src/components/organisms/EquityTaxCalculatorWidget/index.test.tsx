import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EquityTaxCalculatorWidget, equityTaxCalculatorSummary } from '.'

const props = { kind: 'swing', assetClass: 'stock', salesMonth: 15000, profit: 2000, lossCarry: 0 } as const

describe('EquityTaxCalculatorWidget', () => {
    it('ação com vendas até R$ 20 mil mostra ganho isento', () => {
        render(<EquityTaxCalculatorWidget {...props} />)
        expect(screen.getByText(/Imposto devido: R\$\s*0,00/)).toBeInTheDocument()
        expect(screen.getByText(/o ganho é isento/)).toBeInTheDocument()
    })

    it('trocar para ETF tira a isenção e mostra o DARF', () => {
        render(<EquityTaxCalculatorWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: 'ETF' }))
        expect(screen.getByText(/Imposto devido: R\$\s*300,00 \(15%/)).toBeInTheDocument()
        expect(screen.getByText(/DARF a pagar/)).toBeInTheDocument()
    })

    it('day trade cobra 20%', () => {
        render(<EquityTaxCalculatorWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /Day trade/ }))
        expect(screen.getByText(/\(20%/)).toBeInTheDocument()
    })

    it('o resumo textual descreve a calculadora', () => {
        expect(equityTaxCalculatorSummary(props)).toMatch(/DARF/)
    })
})
