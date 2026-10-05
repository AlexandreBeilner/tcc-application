import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_FUNDING } from '../../../features/admin/botFunding'
import { BotFundingForm } from '.'

const assetOptions = [
    { value: '', label: 'Sem posição' },
    { value: 'a1', label: 'AAA3' },
    { value: 'a2', label: 'BBB3' },
]

function renderForm(props: Partial<React.ComponentProps<typeof BotFundingForm>> = {}) {
    const onChange = vi.fn()
    render(
        <BotFundingForm values={EMPTY_FUNDING} onChange={onChange} errors={{}} assetOptions={assetOptions} currentCash={2500} {...props} />,
    )
    return { onChange }
}

describe('BotFundingForm', () => {
    it('mostra o caixa atual e o aviso do teto de float', () => {
        renderForm()
        expect(screen.getByText(/Caixa atual do bot: R\$\s*2\.500,00/)).toBeInTheDocument()
        expect(screen.getByText(/total de cotas em circulação/)).toBeInTheDocument()
    })

    it('digitar caixa e quantidade repassa os valores', () => {
        const { onChange } = renderForm()
        fireEvent.change(screen.getByLabelText(/Caixa a aportar/), { target: { value: '1000' } })
        expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FUNDING, cash: '1000' })
        fireEvent.change(screen.getByLabelText(/Quantidade de cotas/), { target: { value: '40' } })
        expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FUNDING, quantity: '40' })
    })

    it('escolher o ativo repassa o id', async () => {
        const { onChange } = renderForm()
        fireEvent.click(screen.getByRole('button', { name: /Ativo da posição/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'BBB3' }))
        expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_FUNDING, assetId: 'a2' })
    })

    it('mostra os erros do formulário e de cada campo', () => {
        renderForm({
            errors: { form: 'Informe um valor em caixa e/ou uma posição.', cash: 'Valor inválido.', quantity: 'Quantidade inválida.' },
        })
        expect(screen.getAllByRole('alert')).toHaveLength(3)
        expect(screen.getByLabelText(/Caixa a aportar/)).toHaveAttribute('aria-invalid', 'true')
    })
})
