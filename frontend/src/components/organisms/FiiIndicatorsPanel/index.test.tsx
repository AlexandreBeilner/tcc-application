import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FiiIndicatorsPanel } from '.'

describe('FiiIndicatorsPanel', () => {
    it('tijolo mostra segmento, patrimônio e vacância, sem indexador', () => {
        render(
            <FiiIndicatorsPanel
                fii={{ fii_type: 'tijolo', segment: 'Logística', net_worth: 500000, vacancy_rate: 5.2, dividend_history: [] }}
            />,
        )
        expect(screen.getByText('FII de Tijolo')).toBeInTheDocument()
        expect(screen.getByText('Logística')).toBeInTheDocument()
        expect(screen.getByText('5,2%')).toBeInTheDocument()
        expect(screen.queryByText('Indexador')).not.toBeInTheDocument()
    })

    it('papel mostra indexador, sem segmento/vacância', () => {
        render(<FiiIndicatorsPanel fii={{ fii_type: 'papel', indexador: 'IPCA+', portfolio_value: 300000, dividend_history: [] }} />)
        expect(screen.getByText('FII de Papel')).toBeInTheDocument()
        expect(screen.getByText('IPCA+')).toBeInTheDocument()
        expect(screen.queryByText('Segmento')).not.toBeInTheDocument()
        expect(screen.queryByText('Taxa de vacância')).not.toBeInTheDocument()
    })

    it('mostra P/VP com 2 casas quando presente e omite quando ausente', () => {
        const { rerender } = render(<FiiIndicatorsPanel fii={{ fii_type: 'tijolo', price_to_book_value: 0.754, dividend_history: [] }} />)
        expect(screen.getByText('P/VP')).toBeInTheDocument()
        expect(screen.getByText('0,75')).toBeInTheDocument()

        rerender(<FiiIndicatorsPanel fii={{ fii_type: 'tijolo', dividend_history: [] }} />)
        expect(screen.queryByText('P/VP')).not.toBeInTheDocument()
    })

    it('mostra Dividend Yield quando presente', () => {
        render(<FiiIndicatorsPanel fii={{ fii_type: 'papel', dividend_yield: 0.081, dividend_history: [] }} />)
        expect(screen.getByText('8.1%')).toBeInTheDocument()
    })
})
