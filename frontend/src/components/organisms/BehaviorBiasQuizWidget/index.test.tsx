import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BehaviorBiasQuizWidget, behaviorBiasQuizSummary } from '.'

describe('BehaviorBiasQuizWidget', () => {
    it('antes de responder mostra o progresso', () => {
        render(<BehaviorBiasQuizWidget />)
        expect(screen.getByText(/Responda as 4 situações \(0 de 4\)/)).toBeInTheDocument()
    })

    it('ao escolher uma reação com viés, nomeia o viés', () => {
        render(<BehaviorBiasQuizWidget />)
        fireEvent.click(screen.getByRole('button', { name: 'Vendo tudo para não perder mais' }))
        expect(screen.getByText('Aversão à perda.')).toBeInTheDocument()
    })

    it('seguir o plano em tudo fecha com 4 de 4 e dá para refazer', () => {
        render(<BehaviorBiasQuizWidget />)
        for (const name of [
            'Confiro se o motivo da compra mudou e sigo o plano',
            'Pergunto: com o dinheiro em caixa, eu compraria hoje?',
            'Lembro que sorte e mercado em alta contam, e mantenho o plano',
            'Desconfio da pressa e só decido com calma',
        ]) {
            fireEvent.click(screen.getByRole('button', { name }))
        }
        expect(screen.getByText(/Você seguiu o plano em 4 de 4 situações/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Refazer' }))
        expect(screen.getByText(/\(0 de 4\)/)).toBeInTheDocument()
    })

    it('o resumo textual descreve o quiz', () => {
        expect(behaviorBiasQuizSummary({})).toMatch(/Quiz com 4 situações/)
    })
})
