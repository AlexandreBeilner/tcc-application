import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrderSuccessOverlay } from '.'

describe('OrderSuccessOverlay', () => {
    it('mostra a mensagem de sucesso e o rótulo do botão', () => {
        render(<OrderSuccessOverlay message="Você comprou 10 PETR4." continueLabel="Voltar pro Portfólio" onContinue={vi.fn()} />)
        expect(screen.getByRole('status')).toBeInTheDocument()
        expect(screen.getByText('Ordem executada')).toBeInTheDocument()
        expect(screen.getByText('Você comprou 10 PETR4.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Voltar pro Portfólio' })).toBeInTheDocument()
    })

    it('chama onContinue ao clicar no botão', () => {
        const onContinue = vi.fn()
        render(<OrderSuccessOverlay message="Operação concluída." continueLabel="Continuar" onContinue={onContinue} />)
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        expect(onContinue).toHaveBeenCalled()
    })
})
