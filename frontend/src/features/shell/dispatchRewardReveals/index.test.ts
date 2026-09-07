import { describe, expect, it, vi } from 'vitest'
import { dispatchRewardReveals } from '.'

describe('dispatchRewardReveals', () => {
    it('sem nenhum campo de recompensa, não chama show', () => {
        const show = vi.fn()

        dispatchRewardReveals(show, {})

        expect(show).not.toHaveBeenCalled()
    })

    it('chama show na ordem xp -> conquistas -> streak quando os três batem juntos', () => {
        const show = vi.fn()

        dispatchRewardReveals(show, {
            xpAwarded: 50,
            unlockedAchievements: [{ id: 'a1', name: 'Primeiros Passos', description: null }],
            streakMilestone: 7,
        })

        expect(show).toHaveBeenCalledTimes(3)
        expect(show.mock.calls[0][0].title).toBe('+50 XP')
        expect(show.mock.calls[1][0].title).toBe('Primeiros Passos')
        expect(show.mock.calls[2][0].title).toBe('7 dias seguidos!')
    })
})
