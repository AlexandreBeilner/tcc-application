import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EquivalentRateWidget, equivalentRateSummary } from '.'

const props = { exemptRatePct: 9.5, cdbRatePct: 12, daysPresets: [60, 720] }

describe('EquivalentRateWidget', () => {
    it('em 60 dias o isento vence e a taxa equivalente é 12,26%', () => {
        render(<EquivalentRateWidget {...props} />)

        expect(screen.getByText(/Imposto de renda neste prazo: 22,50%/)).toBeInTheDocument()
        expect(screen.getByText('12,26%')).toBeInTheDocument()
        expect(screen.getByText(/O produto isento vence/)).toBeInTheDocument()
    })

    it('ao trocar para 720 dias o CDB vence', () => {
        render(<EquivalentRateWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: '720 dias' }))

        expect(screen.getByRole('button', { name: '720 dias' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText(/Imposto de renda neste prazo: 17,50%/)).toBeInTheDocument()
        expect(screen.getByText(/O CDB vence/)).toBeInTheDocument()
    })

    it('prazo digitado muda a alíquota', () => {
        render(<EquivalentRateWidget {...props} />)
        fireEvent.change(screen.getByLabelText('Prazo (dias)'), { target: { value: '800' } })

        expect(screen.getByText(/Imposto de renda neste prazo: 15,00%/)).toBeInTheDocument()
    })

    it('valor inválido mostra aviso, sem NaN', () => {
        render(<EquivalentRateWidget {...props} />)
        fireEvent.change(screen.getByLabelText('Taxa do CDB (% ao ano)'), { target: { value: '' } })

        expect(screen.getByText('Informe taxas e prazo maiores que zero.')).toBeInTheDocument()
    })

    it('tem resumo textual', () => {
        expect(equivalentRateSummary(props)).toContain('9,50%')
    })
})
