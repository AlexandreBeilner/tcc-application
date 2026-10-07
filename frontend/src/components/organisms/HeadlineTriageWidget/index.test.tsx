import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HEADLINES, HeadlineTriageWidget, headlineTriageSummary } from '.'

describe('HeadlineTriageWidget', () => {
    it('acerto explica o canal', () => {
        render(<HeadlineTriageWidget />)
        fireEvent.click(
            within(screen.getByRole('group', { name: 'Quem tende a sofrer mais?' })).getByRole('button', {
                name: 'Empresa com muita dívida',
            }),
        )

        expect(screen.getByText(/Certo\. Juros mais altos encarecem a dívida/)).toBeInTheDocument()
    })

    it('lucro abaixo do esperado: reação de queda e erro dá o gabarito', () => {
        render(<HeadlineTriageWidget />)
        fireEvent.click(
            within(screen.getByRole('group', { name: 'Qual é a reação mais provável do preço?' })).getByRole('button', {
                name: 'Ficar igual',
            }),
        )

        expect(screen.getByText(/O certo é: Cair, porque ficou abaixo do esperado/)).toBeInTheDocument()
    })

    it('todas as manchetes têm resposta certa dentro das opções', () => {
        for (const headline of HEADLINES) {
            expect(headline.options[headline.answer]).toBeTruthy()
        }
    })

    it('o resumo cita as manchetes', () => {
        expect(headlineTriageSummary({})).toMatch(/4 manchetes de exemplo/)
    })
})
