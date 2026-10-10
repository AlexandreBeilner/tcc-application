import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmailCategoryOption } from '.'

describe('EmailCategoryOption', () => {
    it('mostra título e descrição e avisa a mudança', () => {
        const onChange = vi.fn()
        render(<EmailCategoryOption title="Amigos" description="Pedidos de amizade." checked={false} onChange={onChange} />)

        expect(screen.getByText('Pedidos de amizade.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('checkbox', { name: /Amigos/ }))

        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('desabilitado fica indisponível para o usuário', () => {
        render(<EmailCategoryOption title="Amigos" description="x" checked disabled onChange={vi.fn()} />)

        expect(screen.getByRole('checkbox')).toBeDisabled()
    })
})
