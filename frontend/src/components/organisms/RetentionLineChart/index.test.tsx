import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RetentionLineChart } from '.'

const DAYS = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14']

function renderChart(values: Array<number | null>) {
    return render(
        <RetentionLineChart
            title="Ativos por dia"
            days={DAYS}
            series={[{ key: 'returned', label: 'Voltaram', color: 'var(--color-brand-500)', values, filled: true }]}
            formatValue={(v) => String(v)}
            summary="Resumo para leitor de tela"
            emptyMessage="Sem dados ainda"
            note="Registro desde 10/10"
        />,
    )
}

describe('RetentionLineChart (RT.1.3)', () => {
    it('desenha o gráfico com resumo para leitor de tela, legenda, eixo e nota', () => {
        renderChart([10, 30, 20, 40, 25])
        expect(screen.getByRole('img', { name: 'Resumo para leitor de tela' })).toBeInTheDocument()
        expect(screen.getByRole('list', { name: 'Legenda' })).toHaveTextContent('Voltaram')
        expect(screen.getByText('10/10')).toBeInTheDocument()
        expect(screen.getByText('14/10')).toBeInTheDocument()
        expect(screen.getByText('Registro desde 10/10')).toBeInTheDocument()
        expect(screen.getByText('50')).toBeInTheDocument() // teto redondo do eixo
    })

    it('sem nenhum valor, mostra a mensagem e não é focável', () => {
        renderChart([null, null, null, null, null])
        expect(screen.getByText('Sem dados ainda')).toBeInTheDocument()
        expect(screen.getByRole('img')).not.toHaveAttribute('tabindex')
    })

    it('as setas do teclado percorrem os dias e mostram o valor, com "sem dado" nos buracos', () => {
        renderChart([10, null, 20, 40, 25])
        const chart = screen.getByTestId('retention-line-chart')
        fireEvent.keyDown(chart, { key: 'ArrowRight' })
        expect(screen.getByTestId('retention-line-chart-tooltip')).toHaveTextContent('10/10')
        expect(screen.getByTestId('retention-line-chart-tooltip')).toHaveTextContent('10')
        fireEvent.keyDown(chart, { key: 'ArrowRight' })
        expect(screen.getByTestId('retention-line-chart-tooltip')).toHaveTextContent('11/10')
        expect(screen.getByTestId('retention-line-chart-tooltip')).toHaveTextContent('sem dado')
        fireEvent.keyDown(chart, { key: 'Escape' })
        expect(screen.queryByTestId('retention-line-chart-tooltip')).not.toBeInTheDocument()
    })
})
