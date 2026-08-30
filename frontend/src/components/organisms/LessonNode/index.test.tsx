import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LessonNode } from '.'
import type { Lesson } from '../../../services/lessons'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: 'lesson-1',
        code: '0.1',
        title: 'O que é investir',
        trackNumber: 0,
        trackName: 'Fundamentos',
        sortOrder: 1,
        centralConcept: 'Investir é postergar consumo',
        unlocksDescription: '',
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

describe('LessonNode', () => {
    it('lição concluída mostra o rótulo de concluída e chama onClick', () => {
        const onClick = vi.fn()
        render(<LessonNode lesson={lesson({ status: 'completed' })} onClick={onClick} />)

        const node = screen.getByRole('button', { name: /Concluída/ })
        fireEvent.click(node)
        expect(onClick).toHaveBeenCalledOnce()
    })

    it('lição disponível mostra o rótulo de disponível', () => {
        render(<LessonNode lesson={lesson({ status: 'available' })} onClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /Disponível/ })).toBeInTheDocument()
    })

    it('lição bloqueada mostra o que ela libera', () => {
        render(<LessonNode lesson={lesson({ status: 'locked', unlocksDescription: 'Tesouro Selic' })} onClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /Bloqueada: libera Tesouro Selic/ })).toBeInTheDocument()
    })

    it('lição bloqueada sem unlocksDescription cai no rótulo genérico', () => {
        render(<LessonNode lesson={lesson({ status: 'locked', unlocksDescription: '' })} onClick={vi.fn()} />)

        expect(screen.getByRole('button', { name: /^O que é investir: Bloqueada$/ })).toBeInTheDocument()
    })
})
