import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FixedIncomeSimulator } from '.'

describe('FixedIncomeSimulator', () => {
    it('valor abaixo da aplicação mínima bloqueia o botão com aviso', () => {
        render(<FixedIncomeSimulator minimumInvestment={1000} amount={500} onAmountChange={vi.fn()} onInvest={vi.fn()} />)
        expect(screen.getByText('O valor informado está abaixo da aplicação mínima deste produto.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Investir' })).toBeDisabled()
    })

    it('mercado fechado: desabilita "Investir" mesmo com valor válido e mostra o motivo', () => {
        render(
            <FixedIncomeSimulator
                minimumInvestment={1000}
                amount={2000}
                onAmountChange={vi.fn()}
                onInvest={vi.fn()}
                closedReason="Mercado fechado: fim de semana simulado. Abre segunda 12/01"
            />,
        )
        expect(screen.getByRole('button', { name: 'Investir' })).toBeDisabled()
        expect(screen.getByRole('status')).toHaveTextContent('Abre segunda 12/01')
    })

    it('mostra a projeção quando há simulação e o valor é válido', () => {
        render(
            <FixedIncomeSimulator
                minimumInvestment={1000}
                amount={2000}
                onAmountChange={vi.fn()}
                simulation={{
                    unit_price: 1,
                    quantity_purchased: 2000,
                    gross_projected_value: 2200,
                    tax_rate: 0.2,
                    net_projected_value: 2160,
                }}
                onInvest={vi.fn()}
            />,
        )
        expect(screen.getByText('R$ 2.160,00')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Investir' })).not.toBeDisabled()
    })

    it('mudar o campo de valor chama onAmountChange', () => {
        const onAmountChange = vi.fn()
        render(<FixedIncomeSimulator minimumInvestment={1000} amount={0} onAmountChange={onAmountChange} onInvest={vi.fn()} />)
        fireEvent.change(screen.getByLabelText('Valor do aporte'), { target: { value: '5000' } })
        expect(onAmountChange).toHaveBeenCalledWith(5000)
    })

    it('"Investir" chama onInvest', () => {
        const onInvest = vi.fn()
        render(<FixedIncomeSimulator minimumInvestment={1000} amount={2000} onAmountChange={vi.fn()} onInvest={onInvest} />)
        fireEvent.click(screen.getByRole('button', { name: 'Investir' }))
        expect(onInvest).toHaveBeenCalled()
    })

    it('valor inválido (NaN) bloqueia o botão sem mostrar o aviso de mínimo', () => {
        render(<FixedIncomeSimulator minimumInvestment={1000} amount={NaN} onAmountChange={vi.fn()} onInvest={vi.fn()} />)
        expect(screen.queryByText('O valor informado está abaixo da aplicação mínima deste produto.')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Investir' })).toBeDisabled()
    })

    it('price-flash no valor líquido projetado quando a simulação muda, some depois de 350ms', () => {
        vi.useFakeTimers()
        const simulation = {
            unit_price: 1,
            quantity_purchased: 2000,
            gross_projected_value: 2200,
            tax_rate: 0.2,
            net_projected_value: 2160,
        }
        const { container, rerender } = render(
            <FixedIncomeSimulator
                minimumInvestment={1000}
                amount={2000}
                onAmountChange={vi.fn()}
                simulation={simulation}
                onInvest={vi.fn()}
            />,
        )

        const flashClass = (className: string) => className.split(' ').some((c) => c.includes('flash'))
        expect([...container.querySelectorAll('span')].some((el) => flashClass(el.className))).toBe(true)

        vi.advanceTimersByTime(350)
        rerender(
            <FixedIncomeSimulator
                minimumInvestment={1000}
                amount={2000}
                onAmountChange={vi.fn()}
                simulation={simulation}
                onInvest={vi.fn()}
            />,
        )
        expect([...container.querySelectorAll('span')].some((el) => flashClass(el.className))).toBe(false)
        vi.useRealTimers()
    })
})
