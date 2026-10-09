import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BudgetSplitWidget, budgetSplitSummary } from '.'

const props = { income: 4000, housing: 1500, food: 800, transport: 400, leisure: 300, debts: 200, other: 200 }

describe('BudgetSplitWidget', () => {
    it('mostra a sobra em reais e em porcentagem', () => {
        render(<BudgetSplitWidget {...props} />)
        expect(screen.getByText(/Sobra R\$\s*600,00 \(15% da renda\)/)).toBeInTheDocument()
    })

    it('compara com a regra de bolso 50/30/20', () => {
        render(<BudgetSplitWidget {...props} />)
        expect(screen.getByText(/Necessidades.*67,5% da renda, contra 50%/)).toBeInTheDocument()
        expect(screen.getByText(/regra de bolso popular/)).toBeInTheDocument()
    })

    it('gastar mais do que ganha avisa o vermelho', () => {
        render(<BudgetSplitWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Lazer/), { target: { value: '1500' } })
        expect(screen.getByText(/a mais do que ganha/)).toBeInTheDocument()
    })

    it('o resumo textual descreve o widget', () => {
        expect(budgetSplitSummary(props)).toMatch(/50\/30\/20/)
    })
})
