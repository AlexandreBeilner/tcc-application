import { describe, expect, it } from 'vitest'
import { computeLevelProgress } from '.'

describe('computeLevelProgress', () => {
    it('nível 1 com 0 XP: início do progresso, próximo nível aos 100 XP', () => {
        expect(computeLevelProgress(0, 1)).toEqual({ currentLevelXp: 0, nextLevelXp: 100, progressRatio: 0 })
    })

    it('acabou de subir de nível: progresso zerado no novo nível', () => {
        expect(computeLevelProgress(100, 2)).toEqual({ currentLevelXp: 100, nextLevelXp: 300, progressRatio: 0 })
    })

    it('no meio do caminho pro próximo nível', () => {
        const progress = computeLevelProgress(200, 2)
        expect(progress.progressRatio).toBeCloseTo(0.5)
    })

    it('nunca ultrapassa 1, mesmo com XP acima do esperado pro nível', () => {
        expect(computeLevelProgress(10000, 1).progressRatio).toBe(1)
    })

    it('nunca fica negativo, mesmo com XP abaixo do esperado pro nível', () => {
        expect(computeLevelProgress(0, 3).progressRatio).toBe(0)
    })
})
