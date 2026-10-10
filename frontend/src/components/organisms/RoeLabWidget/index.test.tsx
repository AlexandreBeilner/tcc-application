import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoeLabWidget, roeLabSummary } from '.'

const props = { revenue: 1000, netIncome: 100, assets: 1000, equity: 500, selicPct: 10.5 }

describe('RoeLabWidget', () => {
    it('lucro de 100 sobre patrimônio de 500 dá ROE de 20%, 9,5 pontos acima da Selic de 10,5%', () => {
        render(<RoeLabWidget {...props} />)

        expect(screen.getByText(/ROE de 20,0%/)).toBeInTheDocument()
        expect(screen.getByText(/ROE fica 9,5 ponto acima da Selic/)).toBeInTheDocument()
        expect(screen.getByText(/alavancagem de 2,00x/)).toBeInTheDocument()
    })

    it('mais dívida com o mesmo lucro sobe o ROE e avisa que o risco subiu', () => {
        render(<RoeLabWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/financiada por dívida/), { target: { value: '75' } })

        expect(screen.getByText(/ROE de 40,0%/)).toBeInTheDocument()
        expect(screen.getByText(/o risco subiu junto/)).toBeInTheDocument()
    })

    it('Selic acima do ROE mostra o ROE abaixo da referência', () => {
        render(<RoeLabWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/financiada por dívida/), { target: { value: '0' } })
        fireEvent.change(screen.getByLabelText(/Selic de referência/), { target: { value: '16' } })

        expect(screen.getByText(/ROE fica 6,0 ponto abaixo da Selic/)).toBeInTheDocument()
    })

    it('o resumo cita o lucro', () => {
        expect(roeLabSummary(props)).toMatch(/lucro de R\$\s100 mi/)
    })
})
