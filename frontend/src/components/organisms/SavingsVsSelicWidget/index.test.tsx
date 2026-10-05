import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SavingsVsSelicWidget } from '.'

const props = { selicPct: 14, trMonthlyPct: 0.15, amount: 10000, months: 12 }

describe('SavingsVsSelicWidget', () => {
    it('com Selic alta usa a regra de 0,5% ao mês e o Tesouro Selic líquido vence', () => {
        render(<SavingsVsSelicWidget {...props} />)

        expect(screen.getByText(/rende 0,5% ao mês mais a TR/)).toBeInTheDocument()
        expect(screen.getByText(/Poupança: 8,09% ao ano/)).toBeInTheDocument()
        expect(screen.getByText(/Tesouro Selic: .*R\$ 11\.120,00 depois de 20,0% de imposto/)).toBeInTheDocument()
        expect(screen.getByText(/O Tesouro Selic líquido rende mais/)).toBeInTheDocument()
    })

    it('baixar a Selic para 7% troca a regra para 70% da meta', () => {
        render(<SavingsVsSelicWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Meta da Selic/), { target: { value: '7' } })

        expect(screen.getByText(/rende 70% da meta ao ano mais a TR/)).toBeInTheDocument()
    })
})
