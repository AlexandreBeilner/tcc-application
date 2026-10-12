import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActivityCalendar } from '.'

describe('ActivityCalendar (MO.5.4)', () => {
    it('um item por dia do mês, diferenciando dia ativo de dia off sem usar cor de erro', () => {
        render(<ActivityCalendar activeDays={[1, 2, 9]} daysInMonth={30} />)

        expect(screen.getAllByRole('listitem')).toHaveLength(30)
        expect(screen.getByLabelText('Dia 2: manteve a sequência')).toBeInTheDocument()
        expect(screen.getByLabelText('Dia 3: sem atividade')).toBeInTheDocument()
        expect(screen.getByText(/dia off/)).toBeInTheDocument()
    })

    it('mês de 31 dias e de 28 dias', () => {
        const { rerender } = render(<ActivityCalendar activeDays={[]} daysInMonth={31} />)
        expect(screen.getAllByRole('listitem')).toHaveLength(31)
        rerender(<ActivityCalendar activeDays={[]} daysInMonth={28} />)
        expect(screen.getAllByRole('listitem')).toHaveLength(28)
    })
})
