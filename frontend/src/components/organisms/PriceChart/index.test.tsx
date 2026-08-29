import { fireEvent, render, screen } from '@testing-library/react'
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
})
