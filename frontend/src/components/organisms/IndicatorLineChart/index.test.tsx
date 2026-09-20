import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IndicatorLineChart } from '.'

const ranges = [
    { days: 90, label: '3M' },
    { days: 365, label: '1A' },
]

const formatValue = (value: number) => `${value.toFixed(2)}%`

describe('IndicatorLineChart', () => {
    it('mostra estado vazio com menos de 2 entradas', () => {
        render(
            <IndicatorLineChart
                title="Selic"
                entries={[]}
                ranges={ranges}
                activeDays={90}
                onRangeChange={vi.fn()}
                formatValue={formatValue}
            />,
        )
        expect(screen.getByText('Aguardando histórico suficiente pra desenhar o gráfico.')).toBeInTheDocument()
    })

    it('desenha o gráfico e os limites min/max formatados com 2+ entradas', () => {
        render(
            <IndicatorLineChart
                title="Selic"
                entries={[
                    { simulatedDay: 1, value: 10 },
                    { simulatedDay: 21, value: 9.75 },
                ]}
                ranges={ranges}
                activeDays={90}
                onRangeChange={vi.fn()}
                formatValue={formatValue}
            />,
        )
        expect(screen.getByText('10.00%')).toBeInTheDocument()
        expect(screen.getByText('9.75%')).toBeInTheDocument()
    })

    it('clique num intervalo chama onRangeChange com os dias certos', () => {
        const onRangeChange = vi.fn()
        render(
            <IndicatorLineChart
                title="Selic"
                entries={[]}
                ranges={ranges}
                activeDays={90}
                onRangeChange={onRangeChange}
                formatValue={formatValue}
            />,
        )
        fireEvent.click(screen.getByText('1A'))
        expect(onRangeChange).toHaveBeenCalledWith(365)
    })

    it('hover sobre o gráfico mostra tooltip com dia e valor do ponto mais próximo do cursor', () => {
        render(
            <IndicatorLineChart
                title="Selic"
                entries={[
                    { simulatedDay: 1, value: 10 },
                    { simulatedDay: 21, value: 9.75 },
                ]}
                ranges={ranges}
                activeDays={90}
                onRangeChange={vi.fn()}
                formatValue={formatValue}
            />,
        )

        const chart = screen.getByTestId('indicator-line-chart')
        vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 100,
            width: 100,
            top: 0,
            bottom: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        })

        fireEvent.pointerMove(chart, { clientX: 100 })

        expect(screen.getByText('Dia 21')).toBeInTheDocument()
        expect(screen.getByTestId('indicator-line-chart-tooltip')).toHaveTextContent('9.75%')
    })
})
