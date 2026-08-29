import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '.'

describe('Button', () => {
    it('renderiza como <button type="button"> por padrão', () => {
        render(<Button>Entrar</Button>)

        expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute('type', 'button')
    })

    it('aceita type="submit" via spread de ButtonHTMLAttributes', () => {
        render(<Button type="submit">Criar conta</Button>)

        expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveAttribute('type', 'submit')
    })

    it('chama onClick ao clicar', () => {
        const onClick = vi.fn()
        render(<Button onClick={onClick}>Investir</Button>)

        fireEvent.click(screen.getByRole('button', { name: 'Investir' }))

        expect(onClick).toHaveBeenCalledOnce()
    })

    it('disabled fica presente no DOM e impede o clique', () => {
        const onClick = vi.fn()
        render(
            <Button disabled onClick={onClick}>
                Avançar
            </Button>,
        )

        const button = screen.getByRole('button', { name: 'Avançar' })
        expect(button).toBeDisabled()
        fireEvent.click(button)
        expect(onClick).not.toHaveBeenCalled()
    })

    it('variant secondary e fullWidth renderizam sem erro, mantendo o texto', () => {
        render(
            <Button variant="secondary" fullWidth>
                Ir pra Trilha
            </Button>,
        )

        expect(screen.getByRole('button', { name: 'Ir pra Trilha' })).toBeInTheDocument()
    })
})
