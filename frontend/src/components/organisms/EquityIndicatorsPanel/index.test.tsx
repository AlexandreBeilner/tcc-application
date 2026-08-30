import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EquityIndicatorsPanel } from '.'

describe('EquityIndicatorsPanel', () => {
    it('não renderiza nada sem indicadores', () => {
        const { container } = render(<EquityIndicatorsPanel indicators={undefined} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('mostra só os indicadores presentes, omitindo os ausentes', () => {
        render(<EquityIndicatorsPanel indicators={{ price_to_earnings: 14.2, roe: 0.217 }} />)
        expect(screen.getByText('P/L')).toBeInTheDocument()
        expect(screen.getByText('14,2')).toBeInTheDocument()
        expect(screen.getByText('ROE')).toBeInTheDocument()
        expect(screen.getByText('21.7%')).toBeInTheDocument()
        expect(screen.queryByText('P/VP')).not.toBeInTheDocument()
    })

    it('não renderiza nada quando todos os 9 campos estão ausentes', () => {
        const { container } = render(<EquityIndicatorsPanel indicators={{}} />)
        expect(container).toBeEmptyDOMElement()
    })
})
