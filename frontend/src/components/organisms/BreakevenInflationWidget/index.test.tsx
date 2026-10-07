import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BreakevenInflationWidget, breakevenInflationSummary } from '.'

const props = { prefixedPct: 12.5, realPct: 7.5, expectedInflationPct: 5 }

describe('BreakevenInflationWidget', () => {
    it('12,5% e 7,5% empatam em 4,65%, e 5% esperado favorece o IPCA+', () => {
        render(<BreakevenInflationWidget {...props} />)

        expect(screen.getByText('Inflação de equilíbrio: 4,65% ao ano.')).toBeInTheDocument()
        expect(screen.getByText(/o IPCA\+ rende mais/)).toBeInTheDocument()
    })

    it('inflação esperada baixa favorece o prefixado', () => {
        render(<BreakevenInflationWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Inflação que você espera/), { target: { value: '3' } })

        expect(screen.getByText(/o prefixado rende mais/)).toBeInTheDocument()
    })

    it('o resumo cita as taxas', () => {
        expect(breakevenInflationSummary(props)).toMatch(/prefixado de 12,50% e um IPCA\+ de 7,50%/)
    })
})
