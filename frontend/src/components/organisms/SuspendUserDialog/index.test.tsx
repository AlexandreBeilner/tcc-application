import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SuspendUserDialog } from '.'

describe('SuspendUserDialog', () => {
    it('só habilita suspender com motivo e envia o texto sem espaços nas pontas', () => {
        const onConfirm = vi.fn()
        render(<SuspendUserDialog username="maria" onConfirm={onConfirm} onCancel={vi.fn()} />)
        const confirm = screen.getByRole('button', { name: 'Suspender conta' })
        expect(confirm).toBeDisabled()

        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: '  spam no feed  ' } })
        expect(confirm).toBeEnabled()
        fireEvent.click(confirm)

        expect(onConfirm).toHaveBeenCalledWith('spam no feed')
    })

    it('motivo curto demais não habilita e o erro da tentativa aparece', () => {
        render(<SuspendUserDialog username="maria" error="A conta já está suspensa." onConfirm={vi.fn()} onCancel={vi.fn()} />)
        fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'ab' } })
        expect(screen.getByRole('button', { name: 'Suspender conta' })).toBeDisabled()
        expect(screen.getByRole('alert')).toHaveTextContent('A conta já está suspensa.')
    })

    it('explica o efeito da suspensão e cancela', () => {
        const onCancel = vi.fn()
        render(<SuspendUserDialog username="maria" onConfirm={vi.fn()} onCancel={onCancel} />)
        expect(screen.getByText(/@maria deixa de entrar/)).toBeInTheDocument()
        expect(screen.getByText(/ordens em repouso não são canceladas/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(onCancel).toHaveBeenCalled()
    })
})
