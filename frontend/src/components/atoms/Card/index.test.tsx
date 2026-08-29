import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card } from '.'

describe('Card', () => {
    it('renderiza como <button type="button">, clicável', () => {
        const onClick = vi.fn()
        render(
            <Card onClick={onClick} aria-label="Ver extrato">
                conteúdo
            </Card>,
        )

        const card = screen.getByRole('button', { name: 'Ver extrato' })
        expect(card).toHaveAttribute('type', 'button')
        fireEvent.click(card)
        expect(onClick).toHaveBeenCalledOnce()
    })

    it('accent e className extra renderizam sem erro, preservando o conteúdo', () => {
        render(
            <Card accent className="destaque" aria-label="Retomar lição">
                Reserva de emergência
            </Card>,
        )

        expect(screen.getByRole('button', { name: 'Retomar lição' })).toHaveTextContent('Reserva de emergência')
    })
})
