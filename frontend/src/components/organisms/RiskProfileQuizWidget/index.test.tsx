import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RiskProfileQuizWidget, riskProfileQuizSummary } from '.'

function answerAll(option: 'first' | 'last') {
    for (const group of screen.getAllByRole('group')) {
        const buttons = group.querySelectorAll('button')
        fireEvent.click(option === 'first' ? buttons[0] : buttons[buttons.length - 1])
    }
}

describe('RiskProfileQuizWidget', () => {
    it('antes de responder tudo pede as respostas', () => {
        render(<RiskProfileQuizWidget />)
        expect(screen.getByText(/Responda as 6 perguntas/)).toBeInTheDocument()
    })

    it('respostas mais cautelosas levam ao perfil conservador', () => {
        render(<RiskProfileQuizWidget />)
        answerAll('first')
        expect(screen.getByText(/Perfil conservador \(6 de 18 pontos\)/)).toBeInTheDocument()
    })

    it('respostas tolerantes levam ao perfil arrojado e dá para refazer', () => {
        render(<RiskProfileQuizWidget />)
        answerAll('last')
        expect(screen.getByText(/Perfil arrojado \(18 de 18 pontos\)/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Refazer' }))
        expect(screen.getByText(/Responda as 6 perguntas/)).toBeInTheDocument()
    })

    it('precisar do dinheiro em menos de 1 ano limita o perfil', () => {
        render(<RiskProfileQuizWidget />)
        answerAll('last')
        fireEvent.click(screen.getByRole('button', { name: 'Menos de 1 ano' }))
        expect(screen.getByText(/Perfil conservador/)).toBeInTheDocument()
        expect(screen.getByText(/capacidade de risco pesa mais que a vontade/)).toBeInTheDocument()
    })

    it('o resumo textual descreve o questionário', () => {
        expect(riskProfileQuizSummary({})).toMatch(/Questionário de perfil/)
    })
})
