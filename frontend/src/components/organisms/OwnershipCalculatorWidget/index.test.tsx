import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OwnershipCalculatorWidget, ownershipCalculatorSummary } from '.'

const props = { price: 20, totalShares: 1_000_000, yourShares: 100, profit: 5_000_000, payoutPct: 30 }

describe('OwnershipCalculatorWidget', () => {
    it('100 de 1 milhão de ações: fatia de 0,0100% e dividendo de R$ 150', () => {
        render(<OwnershipCalculatorWidget {...props} />)

        expect(screen.getByText(/dono de 0,0100% da empresa, uma fatia de R\$\s2\.000,00/)).toBeInTheDocument()
        expect(screen.getByText(/seu dividendo é de R\$\s150,00/)).toBeInTheDocument()
    })

    it('sem distribuição o dividendo é zero', () => {
        render(<OwnershipCalculatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Parte do lucro distribuída/), { target: { value: '0' } })

        expect(screen.getByText(/seu dividendo é de R\$\s0,00/)).toBeInTheDocument()
    })

    it('mais ações dobram a fatia', () => {
        render(<OwnershipCalculatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText('Suas ações'), { target: { value: '200' } })

        expect(screen.getByText(/dono de 0,0200%/)).toBeInTheDocument()
    })

    it('o resumo cita a participação', () => {
        expect(ownershipCalculatorSummary(props)).toMatch(/100 de 1\.000\.000 ações/)
    })
})
