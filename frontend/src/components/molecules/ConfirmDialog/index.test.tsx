import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '.'

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
        <ConfirmDialog title="Avançar 5 dias?" confirmLabel="Avançar" onConfirm={onConfirm} onCancel={onCancel} {...props}>
            <p>Afeta todos os usuários.</p>
        </ConfirmDialog>,
    )
    return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
    it('mostra título, corpo e abre o foco em Cancelar (a opção segura)', () => {
        renderDialog()
        expect(screen.getByRole('dialog', { name: 'Avançar 5 dias?' })).toBeInTheDocument()
        expect(screen.getByText('Afeta todos os usuários.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })

    it('confirmar e cancelar chamam os callbacks', () => {
        const { onConfirm, onCancel } = renderDialog()
        fireEvent.click(screen.getByRole('button', { name: 'Avançar' }))
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(onConfirm).toHaveBeenCalledTimes(1)
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('Escape e clique no fundo cancelam; clique dentro do painel não', () => {
        const { onCancel } = renderDialog()
        fireEvent.click(screen.getByRole('dialog'))
        expect(onCancel).not.toHaveBeenCalled()
        fireEvent.keyDown(document, { key: 'Escape' })
        fireEvent.click(screen.getByTestId('confirm-backdrop'))
        expect(onCancel).toHaveBeenCalledTimes(2)
    })

    it('durante a execução trava os botões, troca o rótulo e ignora Escape e fundo', () => {
        const { onCancel } = renderDialog({ pending: true, pendingLabel: 'Avançando…' })
        expect(screen.getByRole('button', { name: 'Avançando…' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
        fireEvent.keyDown(document, { key: 'Escape' })
        fireEvent.click(screen.getByTestId('confirm-backdrop'))
        expect(onCancel).not.toHaveBeenCalled()
    })

    it('com requireText, só habilita o confirmar depois de digitar o texto exato', () => {
        const { onConfirm } = renderDialog({ requireText: 'ACME3' })
        const confirm = screen.getByRole('button', { name: 'Avançar' })
        expect(confirm).toBeDisabled()

        fireEvent.change(screen.getByLabelText(/Para confirmar, digite/), { target: { value: 'acme' } })
        expect(confirm).toBeDisabled()

        fireEvent.change(screen.getByLabelText(/Para confirmar, digite/), { target: { value: 'ACME3' } })
        expect(confirm).toBeEnabled()
        fireEvent.click(confirm)
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('confirmDisabled trava o confirmar sem depender de texto digitado', () => {
        const { onConfirm } = renderDialog({ confirmDisabled: true })
        const confirm = screen.getByRole('button', { name: 'Avançar' })
        expect(confirm).toBeDisabled()
        fireEvent.click(confirm)
        expect(onConfirm).not.toHaveBeenCalled()
    })
})
