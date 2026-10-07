import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RiskReturnScatterWidget, riskReturnScatterSummary } from '.'

const props = { highlight: 'stocks', profile: 'none' } as const

describe('RiskReturnScatterWidget', () => {
    it('mostra a oscilação e o retorno do investimento selecionado', () => {
        render(<RiskReturnScatterWidget {...props} />)
        expect(screen.getByText(/Ações: oscilação de 22% e retorno esperado de 14% ao ano/)).toBeInTheDocument()
    })

    it('selecionar outro investimento troca a leitura', () => {
        render(<RiskReturnScatterWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: 'Poupança' }))
        expect(screen.getByText(/Poupança: oscilação de 0,5%/)).toBeInTheDocument()
    })

    it('com perfil conservador, ações ficam fora da região e a poupança dentro', () => {
        render(<RiskReturnScatterWidget {...props} />)
        fireEvent.click(screen.getByRole('button', { name: 'Conservador' }))
        expect(screen.getByText(/Ações está fora/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Poupança' }))
        expect(screen.getByText(/Poupança está dentro/)).toBeInTheDocument()
    })

    it('avisa que os valores são ilustrativos', () => {
        render(<RiskReturnScatterWidget {...props} />)
        expect(screen.getByText(/Valores ilustrativos/)).toBeInTheDocument()
        expect(riskReturnScatterSummary(props)).toMatch(/perfil de investidor/)
    })
})
