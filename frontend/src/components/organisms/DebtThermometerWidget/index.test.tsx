import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DebtThermometerWidget, debtThermometerSummary } from '.'

const props = { grossDebt: 800, cash: 300, ebit: 250, financialExpense: 50, cdiSharePct: 100 }

describe('DebtThermometerWidget', () => {
    it('dívida de 800 com caixa de 300 e EBIT de 250: líquida de 500, 2,00x o EBIT, cobertura de 5x', () => {
        render(<DebtThermometerWidget {...props} />)

        expect(screen.getByText(/Dívida líquida de R\$\s500 mi, ou 2,00x o EBIT/)).toBeInTheDocument()
        expect(screen.getByText(/Cobertura de juros de 5,00x/)).toBeInTheDocument()
        expect(screen.getByText(/Folgado/)).toBeInTheDocument()
    })

    it('a Selic mais 3 pontos sobre dívida toda em CDI soma 24 aos juros e derruba a cobertura', () => {
        render(<DebtThermometerWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /E se a Selic subir 3 pontos/ }))

        expect(screen.getByText(/Despesa financeira de R\$\s74 mi/)).toBeInTheDocument()
        expect(screen.getByText(/Cobertura de juros de 3,38x/)).toBeInTheDocument()
    })

    it('sem dívida atrelada ao CDI o choque não muda os juros', () => {
        render(<DebtThermometerWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/atrelada ao CDI/), { target: { value: '0' } })
        fireEvent.click(screen.getByRole('button', { name: /E se a Selic subir 3 pontos/ }))

        expect(screen.getByText(/Despesa financeira de R\$\s50 mi/)).toBeInTheDocument()
    })

    it('mais caixa que dívida avisa dívida líquida negativa', () => {
        render(<DebtThermometerWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Caixa:/), { target: { value: '1000' } })

        expect(screen.getByText(/mais caixa do que dívida/)).toBeInTheDocument()
    })

    it('avisa que não vale para banco', () => {
        render(<DebtThermometerWidget {...props} />)

        expect(screen.getByText(/não vale para bancos/)).toBeInTheDocument()
    })

    it('o resumo cita a dívida bruta', () => {
        expect(debtThermometerSummary(props)).toMatch(/dívida bruta de R\$\s800 mi/)
    })
})
