import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InteractiveBalanceWidget, interactiveBalanceSummary } from '.'

const props = {
    netRevenue: 1000,
    costsPct: 55,
    expensesPct: 15,
    financialResult: -100,
    taxPct: 34,
    cash: 200,
    fixedAssets: 300,
    debt: 220,
    otherLiabilities: 100,
}

describe('InteractiveBalanceWidget', () => {
    it('mostra a cascata até o lucro líquido de 132 e o balanço fechando em 500', () => {
        render(<InteractiveBalanceWidget {...props} />)

        expect(screen.getByText(/Lucro líquido de R\$\s132 mi sobre uma receita de R\$\s1\.000 mi/)).toBeInTheDocument()
        expect(
            screen.getByText(/Ativo de R\$\s500 mi é igual ao passivo de R\$\s320 mi mais o patrimônio líquido de R\$\s180 mi/),
        ).toBeInTheDocument()
    })

    it('mais dívida, com o ativo igual, derruba o patrimônio líquido e avisa quando fica negativo', () => {
        render(<InteractiveBalanceWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Dívida:/), { target: { value: '1000' } })

        expect(screen.getByText(/patrimônio líquido de R\$\s-600 mi/)).toBeInTheDocument()
        expect(screen.getByText(/O patrimônio líquido ficou negativo/)).toBeInTheDocument()
    })

    it('mais juros reduzem o lucro', () => {
        render(<InteractiveBalanceWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Juros pagos/), { target: { value: '300' } })

        expect(screen.getByText(/Lucro líquido de R\$\s0 mi/)).toBeInTheDocument()
    })

    it('o resumo cita a receita', () => {
        expect(interactiveBalanceSummary(props)).toMatch(/receita líquida de R\$\s1\.000 mi/)
    })
})
