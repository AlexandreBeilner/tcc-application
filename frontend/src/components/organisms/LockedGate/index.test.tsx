import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LockedGate } from '.'
import type { LockedGateProps } from '.'

function LocationDisplay() {
    return <div data-testid="location">{useLocation().pathname}</div>
}

function renderGate(props: Partial<LockedGateProps> = {}) {
    return render(
        <MemoryRouter initialEntries={['/mercado/ativos/a1']}>
            <LocationDisplay />
            <LockedGate variant="section" {...props} />
        </MemoryRouter>,
    )
}

describe('LockedGate', () => {
    it('mostra o título da lição quando conhecido, nunca o código (Fase Q)', () => {
        renderGate({ lessonTitle: 'Nomenclatura de tickers' })

        expect(screen.getByRole('heading', { level: 2, name: 'Travado pela trilha' })).toBeInTheDocument()
        expect(screen.getByText('Complete a lição "Nomenclatura de tickers" na trilha pra liberar isso.')).toBeInTheDocument()
        expect(screen.queryByText(/Lição \d/)).not.toBeInTheDocument()
    })

    it('mensagem genérica quando nenhuma lição ainda cobre o produto', () => {
        renderGate()

        expect(screen.getByText('Ainda não há lição cobrindo este produto.')).toBeInTheDocument()
    })

    it('CTA navega direto pra lição quando o id é conhecido e alcançável (ou reachable omitido)', () => {
        renderGate({ lessonId: 'lesson-42', lessonTitle: 'X' })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent('/trilha/lesson-42')
    })

    it('CTA navega pro Mapa da Trilha quando só o título é conhecido (403 sem id)', () => {
        renderGate({ lessonTitle: 'X' })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent(/^\/trilha$/)
    })

    it('CTA navega pro Mapa da Trilha quando a lição ainda não é alcançável', () => {
        renderGate({ lessonId: 'lesson-42', lessonTitle: 'X', reachable: false })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent(/^\/trilha$/)
    })

    it.each([
        ['screen', 'status'],
        ['section', 'note'],
        ['inline', 'note'],
    ] as const)('variante %s expõe role=%s e marca a variante', (variant, role) => {
        renderGate({ variant })

        const gate = screen.getByRole(role)
        expect(gate).toHaveAttribute('data-variant', variant)
    })
})
