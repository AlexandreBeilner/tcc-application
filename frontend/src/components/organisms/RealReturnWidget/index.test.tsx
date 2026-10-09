import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RealReturnWidget } from '.'

describe('RealReturnWidget', () => {
    it('mostra o rendimento real e o poder de compra', () => {
        render(<RealReturnWidget nominalPct={10} inflationPct={5} amount={10000} />)

        expect(screen.getByText('Rendimento real').parentElement).toHaveTextContent('4,76%')
        expect(screen.getByText(/Em reais de hoje/)).toHaveTextContent('R$ 10.476,19')
    })

    it('inflação acima do rendimento mostra perda de poder de compra', () => {
        render(<RealReturnWidget nominalPct={4} inflationPct={5} amount={10000} />)
        fireEvent.change(screen.getByLabelText(/Inflação:/), { target: { value: '8' } })

        expect(screen.getByText(/perdeu/)).toBeInTheDocument()
        expect(screen.getByText('Rendimento real').parentElement).toHaveTextContent('-3,70%')
    })
})
