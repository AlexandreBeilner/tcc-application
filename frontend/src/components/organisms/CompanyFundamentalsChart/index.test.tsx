import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CompanyFundamentalsChart } from '.'

describe('CompanyFundamentalsChart', () => {
    it('mostra estado vazio sem nenhum ciclo com net_revenue', () => {
        render(<CompanyFundamentalsChart fundamentals={[{ period_date: '2026-01-01T00:00:00Z', net_revenue: null }]} />)
        expect(screen.getByText('Esta empresa ainda não tem ciclo de relatório suficiente pro gráfico.')).toBeInTheDocument()
    })

    it('renderiza uma barra por ciclo de relatório com net_revenue', () => {
        render(
            <CompanyFundamentalsChart
                fundamentals={[
                    { period_date: '2026-01-01T00:00:00Z', net_revenue: 1000 },
                    { period_date: '2025-10-01T00:00:00Z', net_revenue: 800 },
                ]}
            />,
        )
        expect(screen.getAllByTitle(/R\$/).length).toBe(2)
    })
})
