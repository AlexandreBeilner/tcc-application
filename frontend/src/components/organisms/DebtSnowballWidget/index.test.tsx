import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DebtSnowballWidget, debtSnowballSummary } from '.'

const props = { balance: 5000, monthlyRatePct: 5, payment: 600 }

describe('DebtSnowballWidget', () => {
    it('mostra o prazo e os juros totais', () => {
        render(<DebtSnowballWidget {...props} />)
        expect(screen.getByText(/Você quita em \d+ meses.*só de juros/)).toBeInTheDocument()
        expect(screen.getByText(/5% ao mês equivalem a 79,6% ao ano/)).toBeInTheDocument()
    })

    it('pagamento que não cobre os juros avisa que a dívida não diminui', () => {
        render(<DebtSnowballWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Pagamento por mês/), { target: { value: '200' } })
        expect(screen.getByText(/a dívida não diminui/)).toBeInTheDocument()
    })

    it('o resumo textual descreve o simulador', () => {
        expect(debtSnowballSummary(props)).toMatch(/Calculadora de dívida/)
    })
})
