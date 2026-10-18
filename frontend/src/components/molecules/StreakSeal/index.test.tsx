import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StreakSeal } from '.'

describe('StreakSeal', () => {
    it.each([3, 5] as const)('anuncia a sequência de %i em região polite', (milestone) => {
        render(<StreakSeal milestone={milestone} />)

        const seal = screen.getByText(`${milestone} de primeira seguidas!`)
        expect(seal).toHaveAttribute('aria-live', 'polite')
    })
})
