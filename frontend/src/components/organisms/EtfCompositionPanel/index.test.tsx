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
                }}
            />,
        )
        expect(screen.getByText('IBOVESPA')).toBeInTheDocument()
        expect(screen.getByText('Replicação física total.')).toBeInTheDocument()
        expect(screen.getByText('PETR4')).toBeInTheDocument()
        expect(screen.getByText('12,5%')).toBeInTheDocument()
    })

    it('mostra estado vazio sem holdings cadastrados', () => {
        render(<EtfCompositionPanel etf={{ benchmark_index: 'IBOVESPA', holdings: [] }} />)
        expect(screen.getByText('Composição sintética ainda não cadastrada.')).toBeInTheDocument()
    })
})
