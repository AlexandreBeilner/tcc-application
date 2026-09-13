import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LockedAssetPanel } from '.'

function LocationDisplay() {
    return <div data-testid="location">{useLocation().pathname}</div>
}

function renderPanel(props: Parameters<typeof LockedAssetPanel>[0] = {}) {
    return render(
        <MemoryRouter initialEntries={['/mercado/ativos/a1']}>
            <LocationDisplay />
            <LockedAssetPanel {...props} />
        </MemoryRouter>,
    )
}

describe('LockedAssetPanel', () => {
    it('mostra o título da lição quando conhecido, nunca o código (Fase Q)', () => {
        renderPanel({ lessonTitle: 'Nomenclatura de tickers' })

        expect(screen.getByText('Complete a lição "Nomenclatura de tickers" na trilha pra liberar isso.')).toBeInTheDocument()
        expect(screen.queryByText(/Lição \d/)).not.toBeInTheDocument()
    })

    it('mensagem genérica quando nenhuma lição ainda cobre o produto', () => {
        renderPanel()

        expect(screen.getByText('Ainda não há lição cobrindo este produto.')).toBeInTheDocument()
    })

    it('CTA navega direto pra lição quando o id é conhecido', () => {
        renderPanel({ lessonId: 'lesson-42', lessonTitle: 'Nomenclatura de tickers' })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent('/trilha/lesson-42')
    })

    it('CTA navega pro Mapa da Trilha quando só o título é conhecido (403 sem id)', () => {
        renderPanel({ lessonTitle: 'Nomenclatura de tickers' })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent('/trilha')
    })

    it('CTA navega pro Mapa da Trilha quando o id é conhecido mas a lição ainda não é alcançável', () => {
        renderPanel({ lessonId: 'lesson-42', lessonTitle: 'Nomenclatura de tickers', reachable: false })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent('/trilha')
        expect(screen.getByTestId('location')).not.toHaveTextContent('/trilha/lesson-42')
    })

    it('CTA navega direto pra lição quando reachable não é informado (compat com chamadores que não sabem responder)', () => {
        renderPanel({ lessonId: 'lesson-42', lessonTitle: 'Nomenclatura de tickers' })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent('/trilha/lesson-42')
    })
})
