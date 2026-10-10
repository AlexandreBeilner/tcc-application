import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { xpRevealContent } from '.'

describe('xpRevealContent', () => {
    it('sem xpAwarded nem leveledUp, não há nada a mostrar', () => {
        expect(xpRevealContent({})).toBeNull()
    })

    it('xpAwarded presente mostra o reveal de XP com a quantia', () => {
        const content = xpRevealContent({ xpAwarded: 20 })
        expect(content).not.toBeNull()
        expect(content?.title).toBe('+20 XP')
        render(<>{content?.icon}</>)
        expect(document.querySelector('svg')).toBeInTheDocument()
    })

    it('leveledUp mostra só o reveal de level-up, mesmo com xpAwarded presente', () => {
        const content = xpRevealContent({ xpAwarded: 90, leveledUp: true })
        expect(content).toEqual({
            icon: expect.anything(),
            title: 'Você subiu de nível!',
            description: undefined,
        })
    })

    it('leveledUp com newLevel mostra o salário novo e a diferença (tarefa T.10)', () => {
        const content = xpRevealContent({ leveledUp: true, newLevel: 10 })
        expect(content?.title).toBe('Você subiu de nível!')
        expect(content?.description).toMatch(/^Salário mensal agora é R\$\s1\.000,00 \(\+R\$\s100,00\)$/)
    })

    it('leveledUp no nível 1 (sem nível anterior de verdade) não quebra', () => {
        const content = xpRevealContent({ leveledUp: true, newLevel: 1 })
        expect(content?.description).toMatch(/^Salário mensal agora é R\$\s100,00 \(\+R\$\s100,00\)$/)
    })

    it('leveledUp sem newLevel não mostra descrição', () => {
        const content = xpRevealContent({ leveledUp: true })
        expect(content?.description).toBeUndefined()
    })

    it('leveledUp false com xpAwarded ausente não mostra nada', () => {
        expect(xpRevealContent({ leveledUp: false })).toBeNull()
    })
})
