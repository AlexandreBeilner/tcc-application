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
    it('mostra o código da lição quando conhecido', () => {
        renderPanel({ lessonCode: '2.3' })

        expect(screen.getByText('Desbloqueia na lição 2.3.')).toBeInTheDocument()
    })

    it('mensagem genérica quando nenhuma lição ainda cobre o produto', () => {
        renderPanel()

        expect(screen.getByText('Ainda não há lição cobrindo este produto.')).toBeInTheDocument()
    })

    it('CTA navega direto pra lição quando o id é conhecido', () => {
        renderPanel({ lessonId: 'lesson-42', lessonCode: '2.3' })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent('/trilha/lesson-42')
    })

    it('CTA navega pro Mapa da Trilha quando só o code é conhecido (403 sem id)', () => {
        renderPanel({ lessonCode: '2.3' })

        fireEvent.click(screen.getByText('Ir pra lição'))

        expect(screen.getByTestId('location')).toHaveTextContent('/trilha')
    })
})
