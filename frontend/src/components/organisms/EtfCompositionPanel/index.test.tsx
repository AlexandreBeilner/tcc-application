import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EtfCompositionPanel } from '.'

describe('EtfCompositionPanel', () => {
    it('mostra o índice de referência e a composição sintética', () => {
        render(
            <EtfCompositionPanel
                etf={{
                    benchmark_index: 'IBOVESPA',
                    methodology_summary: 'Replicação física total.',
                    holdings: [{ constituent_name: 'PETR4', weight_pct: 12.5 }],
                    dividend_history: [],
                }}
            />,
        )
        expect(screen.getByText('IBOVESPA')).toBeInTheDocument()
        expect(screen.getByText('Replicação física total.')).toBeInTheDocument()
        expect(screen.getByText('PETR4')).toBeInTheDocument()
        expect(screen.getByText('12,5%')).toBeInTheDocument()
    })

    it('mostra estado vazio sem holdings cadastrados', () => {
        render(<EtfCompositionPanel etf={{ benchmark_index: 'IBOVESPA', holdings: [], dividend_history: [] }} />)
        expect(screen.getByText('Composição sintética ainda não cadastrada.')).toBeInTheDocument()
    })

    it('mostra NAV, deságio, tracking error e cotas quando o fundo já tem NAV', () => {
        render(
            <EtfCompositionPanel
                etf={{
                    benchmark_index: 'IBOVESPA',
                    holdings: [],
                    dividend_history: [],
                    nav: 101.25,
                    premium_pct: -1.5,
                    tracking_error_pct: 2.75,
                    shares_outstanding: 10000,
                }}
            />,
        )
        expect(screen.getByText('Deságio sobre o NAV')).toBeInTheDocument()
        expect(screen.getByText('−1,5%')).toBeInTheDocument()
        expect(screen.getByText('+2,8%')).toBeInTheDocument()
        expect(screen.getByText(/10\.000/)).toBeInTheDocument()
    })

    it('mostra ágio quando o preço está acima do NAV e omite o bloco sem NAV', () => {
        const { rerender } = render(
            <EtfCompositionPanel etf={{ benchmark_index: 'X', holdings: [], dividend_history: [], nav: 100, premium_pct: 0.8 }} />,
        )
        expect(screen.getByText('Ágio sobre o NAV')).toBeInTheDocument()
        rerender(<EtfCompositionPanel etf={{ benchmark_index: 'X', holdings: [], dividend_history: [] }} />)
        expect(screen.queryByText(/NAV/)).not.toBeInTheDocument()
    })
})
