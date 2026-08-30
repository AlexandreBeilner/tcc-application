import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GrowthCalculatorForm } from '.'

describe('GrowthCalculatorForm', () => {
    it('mostra resultado com os valores default (taxa 10% a.a., período 1 ano, composto)', () => {
        render(<GrowthCalculatorForm />)
        expect(screen.getByLabelText('Taxa')).toHaveValue(10)
        expect(screen.getByLabelText('Período')).toHaveValue(1)
        expect(screen.getByText('Juros compostos').className).toContain('tabActive')
        expect(screen.getAllByText('Total investido').length).toBeGreaterThan(0)
        expect(screen.getByText('Total em juros')).toBeInTheDocument()
        expect(screen.getByText('Total final')).toBeInTheDocument()
    })

    it('capital inicial e aporte mensal começam zerados', () => {
        render(<GrowthCalculatorForm />)
        expect(screen.getByLabelText('Capital inicial (R$)')).toHaveValue(null)
        expect(screen.getByLabelText('Aporte mensal (R$)')).toHaveValue(null)
    })

    it('mostra a tabela mês a mês (1 ano = 12 meses + mês 0 + cabeçalho = 14 linhas)', () => {
        render(<GrowthCalculatorForm />)
        expect(screen.getByText('Juros do mês')).toBeInTheDocument()
        expect(screen.getByText('Juros acumulados')).toBeInTheDocument()
        expect(screen.getByText('Total acumulado')).toBeInTheDocument()
        expect(screen.getAllByRole('row')).toHaveLength(14)
    })

    it('alternar pra "Juros simples" muda o resultado calculado', () => {
        render(<GrowthCalculatorForm />)
        fireEvent.change(screen.getByLabelText('Capital inicial (R$)'), { target: { value: '1000' } })
        // Com exatamente 1 ano e sem aporte (defaults), simples e composto
        // convergem pro mesmo total (os dois reproduzem a taxa nominal
        // anual exatamente em 12 meses) — 2 anos garante divergência real.
        fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2' } })
        const compoundTotal = screen.getByText('Total final').closest('div')!.textContent
        fireEvent.click(screen.getByText('Juros simples'))
        const simpleTotal = screen.getByText('Total final').closest('div')!.textContent
        expect(simpleTotal).not.toBe(compoundTotal)
    })

    it('período zerado esconde o gráfico e mostra uma dica', () => {
        render(<GrowthCalculatorForm />)
        fireEvent.change(screen.getByLabelText('Período'), { target: { value: '0' } })
        expect(screen.getByText('Informe um período maior que zero pra ver a projeção.')).toBeInTheDocument()
    })

    it('período só aceita inteiro — valor fracionário é truncado', () => {
        render(<GrowthCalculatorForm />)
        fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2.7' } })
        expect(screen.getByLabelText('Período')).toHaveValue(2)
    })

    it('trocar a unidade da taxa (% a.a. -> % a.m.) reinicia o valor do campo', () => {
        render(<GrowthCalculatorForm />)
        expect(screen.getByLabelText('Taxa')).toHaveValue(10)
        fireEvent.click(screen.getByText('% a.m.'))
        expect(screen.getByLabelText('Taxa')).toHaveValue(null)
    })

    it('trocar a unidade do período (anos -> meses) reinicia o valor do campo', () => {
        render(<GrowthCalculatorForm />)
        expect(screen.getByLabelText('Período')).toHaveValue(1)
        fireEvent.click(screen.getByText('Meses'))
        expect(screen.getByLabelText('Período')).toHaveValue(null)
    })

    it('clicar na unidade já ativa não reinicia o valor', () => {
        render(<GrowthCalculatorForm />)
        fireEvent.click(screen.getByText('% a.a.'))
        expect(screen.getByLabelText('Taxa')).toHaveValue(10)
    })

    it('digitar a taxa direto em % a.m. não é convertida antes de calcular (composto reflete o valor mensal puro)', () => {
        render(<GrowthCalculatorForm />)
        fireEvent.click(screen.getByText('% a.m.'))
        fireEvent.change(screen.getByLabelText('Taxa'), { target: { value: '1' } })
        fireEvent.change(screen.getByLabelText('Capital inicial (R$)'), { target: { value: '1000' } })
        fireEvent.click(screen.getByText('Meses'))
        fireEvent.change(screen.getByLabelText('Período'), { target: { value: '1' } })
        // 1000 a 1% a.m. por 1 mês = 1010, formatado em R$.
        const totalRow = screen.getByText('Total final').closest('div')!
        expect(within(totalRow).getByText('R$ 1.010,00')).toBeInTheDocument()
    })
})
