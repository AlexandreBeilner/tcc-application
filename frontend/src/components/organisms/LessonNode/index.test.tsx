import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LessonNode } from '.'

describe('LessonNode', () => {
    it('concluído chama onClick ao clicar', () => {
        const onClick = vi.fn()
        render(<LessonNode status="completed" title="O que é investir" meta="Concluída" onClick={onClick} />)

        const node = screen.getByRole('button', { name: /Concluída/ })
        fireEvent.click(node)
        expect(onClick).toHaveBeenCalledOnce()
    })

    it('disponível mostra o meta recebido', () => {
        render(<LessonNode status="available" title="O que é investir" meta="Disponível" onClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /Disponível/ })).toBeInTheDocument()
    })

    it('bloqueado mostra o meta recebido', () => {
        render(<LessonNode status="locked" title="O que é investir" meta="Bloqueada: libera Tesouro Selic" onClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /Bloqueada: libera Tesouro Selic/ })).toBeInTheDocument()
    })

    it('rótulo acessível combina título e meta', () => {
        render(<LessonNode status="locked" title="O que é investir" meta="Bloqueada" onClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /^O que é investir: Bloqueada$/ })).toBeInTheDocument()
    })
})
