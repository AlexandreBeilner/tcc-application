import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InflationSelicSeesawWidget, inflationSelicSeesawSummary } from '.'

describe('InflationSelicSeesawWidget', () => {
    it('inflação acima do teto pressiona a Selic para cima', () => {
        render(<InflationSelicSeesawWidget inflationPct={6} />)

        expect(screen.getByText('Pressão para subir a Selic')).toBeInTheDocument()
        expect(screen.getByText(/acima do intervalo da meta/)).toBeInTheDocument()
    })

    it('mover para dentro do intervalo troca para manter, e abaixo do piso para reduzir', () => {
        render(<InflationSelicSeesawWidget inflationPct={6} />)
        const slider = screen.getByLabelText(/Inflação em 12 meses/)

        fireEvent.change(slider, { target: { value: '3' } })
        expect(screen.getByText('Tendência de manter a Selic')).toBeInTheDocument()

        fireEvent.change(slider, { target: { value: '1' } })
        expect(screen.getByText('Pressão para reduzir a Selic')).toBeInTheDocument()
    })

    it('o resumo descreve o ponto de partida', () => {
        expect(inflationSelicSeesawSummary({ inflationPct: 6 })).toMatch(/6,0%/)
    })
})
