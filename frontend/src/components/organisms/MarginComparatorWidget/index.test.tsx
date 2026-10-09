import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarginComparatorWidget, marginComparatorSummary } from '.'

const props = {
    a: { netRevenue: 1000, grossProfit: 400, ebit: 200, netIncome: 50 },
    b: { netRevenue: 200, grossProfit: 90, ebit: 60, netIncome: 40 },
}

describe('MarginComparatorWidget', () => {
    it('A faturando mais não quer dizer margem melhor: B converte 20% contra 5%', () => {
        render(<MarginComparatorWidget {...props} />)

        expect(screen.getByText(/Margem líquida: A com 5,0% e B com 20,0%/)).toBeInTheDocument()
        expect(screen.getByText(/A empresa B converte mais da receita/)).toBeInTheDocument()
    })

    it('editar o lucro de A muda quem converte melhor', () => {
        render(<MarginComparatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText('Lucro líquido da A (R$ mi)'), { target: { value: '300' } })

        expect(screen.getByText(/A empresa A converte mais da receita/)).toBeInTheDocument()
    })

    it('o resumo cita as duas receitas', () => {
        expect(marginComparatorSummary(props)).toMatch(/R\$\s1\.000 mi.*R\$\s200 mi/)
    })
})
