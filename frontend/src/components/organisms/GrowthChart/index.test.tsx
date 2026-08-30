import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GrowthChart } from '.'

describe('GrowthChart', () => {
    it('não renderiza nada com menos de 2 pontos', () => {
        const { container } = render(<GrowthChart points={[{ month: 0, interest: 0, invested: 1000, total: 1000 }]} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('desenha o gráfico com legenda e o valor máximo formatado', () => {
        render(
            <GrowthChart
                points={[
                    { month: 0, interest: 0, invested: 1000, total: 1000 },
                    { month: 1, interest: 0, invested: 1100, total: 1150 },
                ]}
            />,
        )
        expect(screen.getByText('Total investido')).toBeInTheDocument()
        expect(screen.getByText('Total com juros')).toBeInTheDocument()
        expect(screen.getByText('R$ 1.150,00')).toBeInTheDocument()
    })

    it('hover mostra tooltip com mês, investido e total do ponto mais próximo do cursor (tarefa 6.7.1)', () => {
        render(
            <GrowthChart
                points={[
                    { month: 0, interest: 0, invested: 1000, total: 1000 },
                    { month: 1, interest: 0, invested: 1100, total: 1150 },
                    { month: 2, interest: 0, invested: 1200, total: 1310 },
                ]}
            />,
        )

        const chart = screen.getByTestId('growth-chart')
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

        expect(screen.queryByTestId('growth-chart-tooltip')).not.toBeInTheDocument()

        fireEvent.pointerMove(chart, { clientX: 95 })
        const tooltip = within(screen.getByTestId('growth-chart-tooltip'))
        expect(tooltip.getByText('Mês 2')).toBeInTheDocument()
        expect(tooltip.getByText(/Investido:/)).toHaveTextContent('R$ 1.200,00')
        expect(tooltip.getByText(/Total:/)).toHaveTextContent('R$ 1.310,00')

        fireEvent.pointerLeave(chart)
        expect(screen.queryByTestId('growth-chart-tooltip')).not.toBeInTheDocument()
    })
})
