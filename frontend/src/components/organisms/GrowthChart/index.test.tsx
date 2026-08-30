import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GrowthChart } from '.'

describe('GrowthChart', () => {
    it('não renderiza nada com menos de 2 pontos', () => {
        const { container } = render(<GrowthChart points={[{ month: 0, invested: 1000, total: 1000 }]} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('desenha o gráfico com legenda e o valor máximo formatado', () => {
        render(
            <GrowthChart
                points={[
                    { month: 0, invested: 1000, total: 1000 },
                    { month: 1, invested: 1100, total: 1150 },
                ]}
            />,
        )
        expect(screen.getByText('Total investido')).toBeInTheDocument()
        expect(screen.getByText('Total com juros')).toBeInTheDocument()
        expect(screen.getByText('R$ 1.150,00')).toBeInTheDocument()
    })
})
