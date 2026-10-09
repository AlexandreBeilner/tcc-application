import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LessonCallout } from '.'

describe('LessonCallout', () => {
    it('mostra título, corpo e fórmula', () => {
        render(<LessonCallout tone="tip" title="Juros compostos" body="Juros sobre juros." formula="M = C x (1 + i)^n" />)

        expect(screen.getByRole('heading', { name: 'Juros compostos' })).toBeInTheDocument()
        expect(screen.getByText('Juros sobre juros.')).toBeInTheDocument()
        expect(screen.getByText('M = C x (1 + i)^n')).toBeInTheDocument()
    })

    it('fórmula é opcional', () => {
        render(<LessonCallout title="Aviso" body="Texto" />)

        expect(screen.queryByText(/M = /)).not.toBeInTheDocument()
    })
})
