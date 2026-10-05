import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BotCreateForm } from '.'

function renderForm(overrides: Partial<Parameters<typeof BotCreateForm>[0]> = {}) {
    const onSubmit = vi.fn()
    render(<BotCreateForm onSubmit={onSubmit} pending={false} {...overrides} />)
    return onSubmit
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Criar bot' }))

describe('BotCreateForm', () => {
    it('sem escopo escolhido não envia e mostra o aviso', () => {
        const onSubmit = renderForm()
        submit()
        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent('pelo menos um setor')
    })

    it('com escopo e os padrões, envia os valores digitados', () => {
        const onSubmit = renderForm()
        fireEvent.click(screen.getByRole('checkbox', { name: 'Varejo' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'FIIs' }))
        submit()
        expect(onSubmit).toHaveBeenCalledTimes(1)
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            archetype: 'ruido',
            sectors: ['Varejo'],
            assetClasses: ['fii'],
            withinScopePct: '90',
            maxPositionSizePct: '30',
            initialCash: '100000000',
        })
    })

    it('valor fora da faixa bloqueia o envio e mostra o erro no campo', () => {
        const onSubmit = renderForm()
        fireEvent.click(screen.getByRole('checkbox', { name: 'Energia' }))
        fireEvent.change(screen.getByLabelText(/Atividade dentro do escopo/), { target: { value: '50' } })
        submit()
        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getByRole('alert')).toHaveTextContent('entre 85 e 90')
    })

    it('conhecimento só aparece no Fundamentalista e teto só no Market Maker', async () => {
        renderForm()
        expect(screen.queryByLabelText(/Nível de conhecimento/)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/Teto de ativos cobertos/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Arquétipo do bot/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'Fundamentalista' }))
        expect(screen.getByLabelText(/Nível de conhecimento/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Arquétipo do bot/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'Market Maker' }))
        expect(screen.queryByLabelText(/Nível de conhecimento/)).not.toBeInTheDocument()
        expect(screen.getByLabelText(/Teto de ativos cobertos/)).toBeInTheDocument()
        // Market Maker nasce com os padrões dele: spread de 2% e posição de 50%.
        expect(screen.getByLabelText(/Largura do spread/)).toHaveValue('2')
        expect(screen.getByLabelText(/Tamanho máximo de posição/)).toHaveValue('50')
    })

    it('trocar o arquétipo preserva escopo e caixa já digitados', async () => {
        renderForm()
        fireEvent.click(screen.getByRole('checkbox', { name: 'Varejo' }))
        fireEvent.change(screen.getByLabelText(/Caixa inicial/), { target: { value: '5000' } })
        fireEvent.click(screen.getByRole('button', { name: /Arquétipo do bot/ }))
        fireEvent.click(await screen.findByRole('option', { name: 'Chartista' }))
        expect(screen.getByRole('checkbox', { name: 'Varejo' })).toBeChecked()
        expect(screen.getByLabelText(/Caixa inicial/)).toHaveValue('5000')
    })

    it('mostra a recusa do motor e trava o botão durante o envio', () => {
        renderForm({ pending: true, errorMessage: 'O motor recusou: escopo vazio' })
        expect(screen.getByText('O motor recusou: escopo vazio')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Criando…' })).toBeDisabled()
    })
})
