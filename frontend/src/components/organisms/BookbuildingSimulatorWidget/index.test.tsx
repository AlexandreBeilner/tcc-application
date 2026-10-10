import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BookbuildingSimulatorWidget, bookbuildingSimulatorSummary } from '.'

const props = { offeredShares: 1_000_000, primaryPct: 60, existingShares: 4_000_000 }

describe('BookbuildingSimulatorWidget', () => {
    it('1 milhão de ações: corte em R$ 20,00 e caixa de R$ 12 milhões', () => {
        render(<BookbuildingSimulatorWidget {...props} />)

        expect(screen.getByText(/Preço de corte: R\$\s20,00\. A oferta foi coberta 1,00 vez/)).toBeInTheDocument()
        expect(screen.getByText(/caixa da empresa: R\$\s12\.000\.000,00/)).toBeInTheDocument()
    })

    it('100% secundária não põe caixa na empresa', () => {
        render(<BookbuildingSimulatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Parte primária/), { target: { value: '0' } })

        expect(screen.getByText(/caixa da empresa: R\$\s0,00/)).toBeInTheDocument()
    })

    it('oferta menor sobe o preço de corte', () => {
        render(<BookbuildingSimulatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Ações ofertadas/), { target: { value: '500000' } })

        expect(screen.getByText(/Preço de corte: R\$\s21,00/)).toBeInTheDocument()
    })

    it('oferta maior que a demanda não fecha', () => {
        render(<BookbuildingSimulatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Ações ofertadas/), { target: { value: '2000000' } })

        expect(screen.getByText(/IPO não fecha/)).toBeInTheDocument()
    })

    it('o resumo cita a oferta', () => {
        expect(bookbuildingSimulatorSummary(props)).toMatch(/1\.000\.000 ações ofertadas/)
    })
})
