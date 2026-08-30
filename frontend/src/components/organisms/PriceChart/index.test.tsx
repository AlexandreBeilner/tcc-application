import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PriceChart } from '.'

const ranges = [
    { days: 30, label: '30D' },
    { days: 365, label: '1A' },
]

describe('PriceChart', () => {
    it('mostra estado vazio com menos de 2 cotações', () => {
        render(<PriceChart quotes={[]} ranges={ranges} activeDays={30} onRangeChange={vi.fn()} />)
        expect(screen.getByText('Aguardando cotações suficientes pra desenhar o gráfico.')).toBeInTheDocument()
    })

    it('desenha o gráfico e os limites min/max com 2+ cotações', () => {
        render(
            <PriceChart
                quotes={[
                    { simulated_day: 1, price: 10 },
                    { simulated_day: 2, price: 20 },
                ]}
                ranges={ranges}
                activeDays={30}
                onRangeChange={vi.fn()}
            />,
        )
        expect(screen.getByText('R$ 20,00')).toBeInTheDocument()
        expect(screen.getByText('R$ 10,00')).toBeInTheDocument()
    })

    it('clique num intervalo chama onRangeChange com os dias certos', () => {
        const onRangeChange = vi.fn()
        render(<PriceChart quotes={[]} ranges={ranges} activeDays={30} onRangeChange={onRangeChange} />)
        fireEvent.click(screen.getByText('1A'))
        expect(onRangeChange).toHaveBeenCalledWith(365)
    })

    it('hover sobre o gráfico mostra tooltip com dia e preço do ponto mais próximo do cursor', () => {
        render(
            <PriceChart
                quotes={[
                    { simulated_day: 1, price: 10 },
                    { simulated_day: 2, price: 20 },
                ]}
                ranges={ranges}
                activeDays={30}
                onRangeChange={vi.fn()}
            />,
        )

        const chart = screen.getByTestId('price-chart')
        vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            right: 100,
            width: 100,
            top: 0,
            bottom: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => '',
        })

        expect(screen.queryByTestId('price-chart-tooltip')).not.toBeInTheDocument()

        fireEvent.pointerMove(chart, { clientX: 90 })
        let tooltip = within(screen.getByTestId('price-chart-tooltip'))
        expect(tooltip.getByText('Dia 2')).toBeInTheDocument()
        expect(tooltip.getByText('R$ 20,00')).toBeInTheDocument()

        fireEvent.pointerMove(chart, { clientX: 10 })
        tooltip = within(screen.getByTestId('price-chart-tooltip'))
        expect(tooltip.getByText('Dia 1')).toBeInTheDocument()
        expect(tooltip.getByText('R$ 10,00')).toBeInTheDocument()

        fireEvent.pointerLeave(chart)
        expect(screen.queryByTestId('price-chart-tooltip')).not.toBeInTheDocument()
    })
})
