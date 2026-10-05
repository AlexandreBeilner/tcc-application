import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BotEditValues } from '../../../features/admin/botEdit'
import { BotEditForm } from '.'

const values: BotEditValues = {
    sectors: ['Varejo'],
    riskClasses: [],
    assetClasses: ['fii'],
    withinScopePct: '90',
    knowledgeLevelPct: '60',
    maxPositionSizePct: '30',
    spreadWidthPct: '2',
}

function renderForm(props: Partial<React.ComponentProps<typeof BotEditForm>> = {}) {
    const onChange = vi.fn()
    render(<BotEditForm archetype="fundamentalista" values={values} onChange={onChange} errors={{}} {...props} />)
    return { onChange }
}

describe('BotEditForm', () => {
    it('mostra os valores atuais e marca o escopo selecionado', () => {
        renderForm()
        expect(screen.getByRole('checkbox', { name: 'Varejo' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Energia' })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'FIIs' })).toBeChecked()
        expect(screen.getByLabelText(/Atividade dentro do escopo/)).toHaveValue('90')
        expect(screen.getByLabelText(/Largura do spread/)).toHaveValue('2')
    })

    it('conhecimento só aparece no fundamentalista e a preferência por ordem a mercado nunca aparece', () => {
        renderForm()
        expect(screen.getByLabelText(/Nível de conhecimento/)).toBeInTheDocument()
        expect(screen.queryByLabelText(/Preferência por ordem a mercado/)).not.toBeInTheDocument()
        expect(screen.getByText(/não é editável/)).toBeInTheDocument()
    })

    it('chartista não mostra conhecimento', () => {
        renderForm({ archetype: 'chartista' })
        expect(screen.queryByLabelText(/Nível de conhecimento/)).not.toBeInTheDocument()
    })

    it('alterar campo e escopo repassa os valores novos', () => {
        const { onChange } = renderForm()
        fireEvent.change(screen.getByLabelText(/Largura do spread/), { target: { value: '3' } })
        expect(onChange).toHaveBeenLastCalledWith({ ...values, spreadWidthPct: '3' })
        fireEvent.click(screen.getByRole('checkbox', { name: 'Energia' }))
        expect(onChange).toHaveBeenLastCalledWith({ ...values, sectors: ['Varejo', 'Energia'] })
        fireEvent.click(screen.getByRole('checkbox', { name: 'Varejo' }))
        expect(onChange).toHaveBeenLastCalledWith({ ...values, sectors: [] })
    })

    it('mostra o erro de cada campo', () => {
        renderForm({ errors: { sectors: 'Escolha pelo menos um item.', withinScopePct: 'Use um valor entre 85 e 90.' } })
        expect(screen.getByText('Escolha pelo menos um item.')).toBeInTheDocument()
        expect(screen.getByText('Use um valor entre 85 e 90.')).toBeInTheDocument()
        expect(screen.getByLabelText(/Atividade dentro do escopo/)).toHaveAttribute('aria-invalid', 'true')
    })
})
