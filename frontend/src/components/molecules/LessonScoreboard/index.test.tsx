import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonScoreboard } from '.'

describe('LessonScoreboard', () => {
    it('mostra a frase do placar e um ponto por pergunta, só como decoração', () => {
        const { container } = render(<LessonScoreboard states={['first-try', 'later', 'pending']} summary="1 de 3 de primeira" />)
        expect(screen.getByText('1 de 3 de primeira')).toBeInTheDocument()
        const dots = container.querySelector('[aria-hidden="true"]')
        expect(dots?.children).toHaveLength(3)
    })
})
