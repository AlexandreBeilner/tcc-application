import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FiiMonthlyCalendarWidget, fiiMonthlyCalendarSummary } from '.'

const props = { monthlyPerShare: 1, shares: 100, price: 100, payoutBusinessDay: 10 }

describe('FiiMonthlyCalendarWidget', () => {
    it('janeiro: R$ 100 de rendimento, data com no fim de janeiro e pagamento no 10º dia útil de fevereiro', () => {
        render(<FiiMonthlyCalendarWidget {...props} />)

        expect(screen.getByText(/Rendimento de janeiro: R\$\s100,00/)).toBeInTheDocument()
        expect(screen.getByText(/Data com: último dia útil de janeiro/)).toBeInTheDocument()
        expect(screen.getByText(/Pagamento: 10º dia útil de fevereiro/)).toBeInTheDocument()
    })

    it('R$ 1,00 por mês numa cota de R$ 100 dá 12% ao ano e R$ 1.200 com 100 cotas', () => {
        render(<FiiMonthlyCalendarWidget {...props} />)

        expect(screen.getByText(/12 pagamentos, R\$\s1\.200,00 no total, ou 12,0% ao ano/)).toBeInTheDocument()
    })

    it('escolher dezembro vira o ano e mudar o dia útil muda o pagamento', () => {
        render(<FiiMonthlyCalendarWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: 'dez' }))
        fireEvent.change(screen.getByLabelText(/Dia útil de pagamento/), { target: { value: '5' } })

        expect(screen.getByText(/Data ex: 1º dia útil de janeiro/)).toBeInTheDocument()
        expect(screen.getByText(/Pagamento: 5º dia útil de janeiro/)).toBeInTheDocument()
    })

    it('diz que o rendimento é isento nas condições da lei', () => {
        render(<FiiMonthlyCalendarWidget {...props} />)

        expect(screen.getByText(/isento de IR quando o fundo tem pelo menos 100 cotistas/)).toBeInTheDocument()
        expect(fiiMonthlyCalendarSummary(props)).toMatch(/100 cotas/)
    })
})
