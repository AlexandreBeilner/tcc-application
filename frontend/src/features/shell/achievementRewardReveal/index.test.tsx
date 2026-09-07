import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { achievementRevealContents } from '.'

describe('achievementRevealContents', () => {
    it('sem unlockedAchievements, não há nada a mostrar', () => {
        expect(achievementRevealContents({})).toEqual([])
    })

    it('unlockedAchievements vazio não mostra nada', () => {
        expect(achievementRevealContents({ unlockedAchievements: [] })).toEqual([])
    })

    it('1 conquista desbloqueada vira 1 reveal com nome e descrição', () => {
        const [content] = achievementRevealContents({
            unlockedAchievements: [{ id: 'a1', name: 'Primeiro Passo', description: 'Complete sua primeira lição' }],
        })
        expect(content.title).toBe('Primeiro Passo')
        expect(content.description).toBe('Complete sua primeira lição')
        render(<>{content.icon}</>)
        expect(document.querySelector('svg')).toBeInTheDocument()
    })

    it('descrição nula vira description undefined (sem parágrafo vazio no reveal)', () => {
        const [content] = achievementRevealContents({
            unlockedAchievements: [{ id: 'a1', name: 'Primeiro Passo', description: null }],
        })
        expect(content.description).toBeUndefined()
    })

    it('múltiplas conquistas viram 1 reveal cada, na mesma ordem recebida', () => {
        const contents = achievementRevealContents({
            unlockedAchievements: [
                { id: 'a1', name: 'Primeiro Passo', description: null },
                { id: 'a2', name: 'Sequência de 7 dias', description: 'Streak de 7 dias' },
            ],
        })
        expect(contents.map((c) => c.title)).toEqual(['Primeiro Passo', 'Sequência de 7 dias'])
    })
})
