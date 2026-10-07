import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RATING_SCALE, RatingRulerWidget, ratingRulerSummary } from '.'

describe('RatingRulerWidget', () => {
    it('começa na nota indicada, como grau de investimento', () => {
        render(<RatingRulerWidget highlight="AA" />)

        expect(screen.getByText('Nota AA: grau de investimento')).toBeInTheDocument()
    })

    it('BB já é grau especulativo', () => {
        render(<RatingRulerWidget highlight="AA" />)
        fireEvent.click(screen.getByRole('button', { name: 'BB' }))

        expect(screen.getByText('Nota BB: grau especulativo')).toBeInTheDocument()
    })

    it('a escala tem 10 notas e o corte fica entre BBB e BB', () => {
        expect(RATING_SCALE).toHaveLength(10)
        expect(RATING_SCALE.filter((item) => item.investmentGrade).map((item) => item.grade)).toEqual(['AAA', 'AA', 'A', 'BBB'])
    })

    it('o resumo cita a nota inicial', () => {
        expect(ratingRulerSummary({ highlight: 'BBB' })).toMatch(/nota BBB/)
    })
})
