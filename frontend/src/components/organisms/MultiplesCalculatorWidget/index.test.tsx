import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MultiplesCalculatorWidget, multiplesCalculatorSummary } from '.'

const props = { price: 24, netIncome: 120, equity: 300, shares: 60, selicPct: 10.5 }

describe('MultiplesCalculatorWidget', () => {
    it('preço de R$ 24 com lucro por ação de R$ 2 dá P/L de 12 e P/VP de 4,8', () => {
        render(<MultiplesCalculatorWidget {...props} />)

        expect(screen.getByText(/P\/L de 12,00x e P\/VP de 4,80x/)).toBeInTheDocument()
        expect(screen.getByText(/Valor de mercado de R\$\s1\.440 mi/)).toBeInTheDocument()
    })

    it('preço mais baixo derruba os dois múltiplos', () => {
        render(<MultiplesCalculatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Preço da ação/), { target: { value: '12' } })

        expect(screen.getByText(/P\/L de 6,00x e P\/VP de 2,40x/)).toBeInTheDocument()
    })

    it('prejuízo não tem P/L', () => {
        render(<MultiplesCalculatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Lucro líquido de 12 meses/), { target: { value: '-30' } })

        expect(screen.getByText(/P\/L de sem sentido/)).toBeInTheDocument()
        expect(screen.getByText(/Sem lucro positivo, o P\/L não faz sentido/)).toBeInTheDocument()
    })

    it('o resumo cita as ações', () => {
        expect(multiplesCalculatorSummary(props)).toMatch(/60 milhões de ações/)
    })
})
