import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RewardReveal } from '.'

describe('RewardReveal', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('mostra ícone, título e descrição', () => {
        render(
            <RewardReveal icon={<span data-testid="icon" />} title="+20 XP" description="Você completou uma lição." onDismiss={vi.fn()} />,
        )
        expect(screen.getByRole('status')).toBeInTheDocument()
        expect(screen.getByTestId('icon')).toBeInTheDocument()
        expect(screen.getByText('+20 XP')).toBeInTheDocument()
        expect(screen.getByText('Você completou uma lição.')).toBeInTheDocument()
    })

    it('renderiza sem descrição quando ela não é passada', () => {
        render(<RewardReveal icon={<span />} title="+20 XP" onDismiss={vi.fn()} />)
        expect(screen.getByText('+20 XP')).toBeInTheDocument()
    })

    it('chama onDismiss ao clicar no botão de fechar', () => {
        const onDismiss = vi.fn()
        render(<RewardReveal icon={<span />} title="+20 XP" onDismiss={onDismiss} />)
        fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
        expect(onDismiss).toHaveBeenCalled()
    })

    it('chama onDismiss sozinho depois do tempo de exibição', () => {
        vi.useFakeTimers()
        const onDismiss = vi.fn()
        render(<RewardReveal icon={<span />} title="+20 XP" onDismiss={onDismiss} />)
        expect(onDismiss).not.toHaveBeenCalled()
        vi.advanceTimersByTime(4000)
        expect(onDismiss).toHaveBeenCalled()
    })
})
