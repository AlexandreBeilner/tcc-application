import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReauthDialog } from '.'

describe('ReauthDialog', () => {
    it('envia a senha digitada ao confirmar', () => {
        const onSubmit = vi.fn()
        render(<ReauthDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
        fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-forte-123' } })
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
        expect(onSubmit).toHaveBeenCalledWith('senha-forte-123')
    })

    it('Enter no campo confirma e senha vazia não envia', () => {
        const onSubmit = vi.fn()
        render(<ReauthDialog onSubmit={onSubmit} onCancel={vi.fn()} />)
        const input = screen.getByLabelText('Senha')
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onSubmit).not.toHaveBeenCalled()
        fireEvent.change(input, { target: { value: 'abc' } })
        fireEvent.keyDown(input, { key: 'Enter' })
        expect(onSubmit).toHaveBeenCalledWith('abc')
    })

    it('mostra o erro da tentativa anterior e cancela', () => {
        const onCancel = vi.fn()
        render(<ReauthDialog error="Senha incorreta." onSubmit={vi.fn()} onCancel={onCancel} />)
        expect(screen.getByRole('alert')).toHaveTextContent('Senha incorreta.')
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        expect(onCancel).toHaveBeenCalled()
    })
})
