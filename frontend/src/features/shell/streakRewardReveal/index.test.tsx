import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { streakRevealContent } from '.'

describe('streakRevealContent', () => {
    it('sem streakMilestone, não há nada a mostrar', () => {
        expect(streakRevealContent({})).toBeNull()
    })

    it('streakMilestone null (dia sem marco batido) não mostra nada', () => {
        expect(streakRevealContent({ streakMilestone: null })).toBeNull()
    })

    it('streakMilestone 7 mostra o reveal com a contagem', () => {
        const content = streakRevealContent({ streakMilestone: 7 })
        expect(content).not.toBeNull()
        expect(content?.title).toBe('7 dias seguidos!')
        render(<>{content?.icon}</>)
        expect(document.querySelector('svg')).toBeInTheDocument()
    })

    it('streakMilestone 30 mostra o reveal com a contagem', () => {
        const content = streakRevealContent({ streakMilestone: 30 })
        expect(content?.title).toBe('30 dias seguidos!')
    })
})
