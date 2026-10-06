import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EtfShockSimulatorWidget, etfShockSimulatorSummary } from '.'

const holdings = [
    { name: 'Empresa A', weightPct: 40 },
    { name: 'Empresa B', weightPct: 20 },
    { name: 'Empresa C', weightPct: 25 },
    { name: 'Empresa D', weightPct: 15 },
]
const props = { holdings, navBefore: 100 }

describe('EtfShockSimulatorWidget', () => {
    it('sem choque o ETF não varia', () => {
        render(<EtfShockSimulatorWidget {...props} />)

        expect(screen.getByText(/O ETF varia 0,0%/)).toBeInTheDocument()
    })

    it('a Empresa A, com 40% da cesta, cai 20%: o ETF cai 8% e a cota vai a R$ 92,00', () => {
        render(<EtfShockSimulatorWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /Empresa A cai 20%/ }))

        expect(screen.getByText(/O ETF varia -8,0%: a cota vai de R\$\s100,00 para R\$\s92,00/)).toBeInTheDocument()
    })

    it('mexer em um ativo só muda a contribuição dele', () => {
        render(<EtfShockSimulatorWidget {...props} />)
        fireEvent.change(screen.getByLabelText(/Empresa D, 15% da cesta/), { target: { value: '-20' } })

        expect(screen.getByText('-3,0% no ETF')).toBeInTheDocument()
    })

    it('zerar volta ao ponto de partida', () => {
        render(<EtfShockSimulatorWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: /Todos caem 10%/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Zerar' }))

        expect(screen.getByText(/O ETF varia 0,0%/)).toBeInTheDocument()
    })

    it('o resumo cita os pesos', () => {
        expect(etfShockSimulatorSummary(props)).toMatch(/40%, 20%, 25%, 15%/)
    })
})
