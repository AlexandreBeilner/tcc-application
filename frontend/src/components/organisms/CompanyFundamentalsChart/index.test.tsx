import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompanyFundamentalsChart } from '.'

describe('CompanyFundamentalsChart', () => {
    it('mostra estado vazio sem nenhum ciclo com net_revenue', () => {
        render(<CompanyFundamentalsChart fundamentals={[{ period_date: '2026-01-01T00:00:00Z', net_revenue: null }]} />)
        expect(screen.getByText('Esta empresa ainda não tem ciclo de relatório suficiente pro gráfico.')).toBeInTheDocument()
    })

    it('renderiza uma barra por ciclo de relatório, com tooltip estilizado (não o title nativo)', () => {
        render(
            <CompanyFundamentalsChart
                fundamentals={[
                    { period_date: '2026-01-01T00:00:00Z', net_revenue: 1000 },
                    { period_date: '2025-10-01T00:00:00Z', net_revenue: 800 },
                ]}
            />,
        )
        expect(screen.getAllByText('R$ 1.000,00', { selector: 'span' }).length).toBe(1)
        expect(screen.getAllByText('R$ 800,00', { selector: 'span' }).length).toBe(1)
        expect(screen.queryAllByTitle(/R\$/).length).toBe(0)
        expect(screen.getByLabelText(/: R\$ 1\.000,00$/)).toBeInTheDocument()
    })

    it('usa a altura mínima sem NaN quando todo net_revenue é zero', () => {
        const { container } = render(
            <CompanyFundamentalsChart
                fundamentals={[
                    { period_date: '2026-01-01T00:00:00Z', net_revenue: 0 },
                    { period_date: '2025-10-01T00:00:00Z', net_revenue: 0 },
                ]}
            />,
        )
        const bars = container.querySelectorAll('[class*="barFill"]')
        expect(bars.length).toBe(2)
        for (const bar of bars) {
            expect((bar as HTMLElement).style.height).toBe('4%')
        }
    })
})
