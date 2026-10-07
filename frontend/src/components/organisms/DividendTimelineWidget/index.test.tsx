import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DividendTimelineWidget, dividendTimelineSummary } from '.'

const props = { quantity: 100, valuePerShare: 1, comDay: 3, paymentDay: 12 }

describe('DividendTimelineWidget', () => {
    it('comprando na data com recebe 100 ações a R$ 1,00', () => {
        render(<DividendTimelineWidget {...props} />)

        expect(screen.getByText(/Você recebe R\$\s100,00/)).toBeInTheDocument()
    })

    it('comprando na data ex não recebe', () => {
        render(<DividendTimelineWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Dia da compra/), { target: { value: '4' } })

        expect(screen.getByText('Você não recebe este provento.')).toBeInTheDocument()
    })

    it('quem já tem e vende até a data com perde o direito, e vendendo na data ex ainda recebe', () => {
        render(<DividendTimelineWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /vendo/ }))
        fireEvent.change(screen.getByLabelText(/Dia da venda/), { target: { value: '3' } })
        expect(screen.getByText('Você não recebe este provento.')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText(/Dia da venda/), { target: { value: '4' } })
        expect(screen.getByText(/Você recebe/)).toBeInTheDocument()
    })

    it('mostra os quatro marcos e o resumo cita a data com', () => {
        render(<DividendTimelineWidget {...props} />)

        for (const name of ['Anúncio', 'Data com', 'Data ex', 'Pagamento']) expect(screen.getByText(name)).toBeInTheDocument()
        expect(dividendTimelineSummary(props)).toMatch(/data com no dia 3/)
    })
})
