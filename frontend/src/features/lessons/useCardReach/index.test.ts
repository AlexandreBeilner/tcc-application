import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/AuthContext'
import { recordCardReach } from '../../../services/lessons'
import { isBeyondReported, useCardReach } from '.'

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../../services/lessons', () => ({ recordCardReach: vi.fn() }))

describe('isBeyondReported', () => {
    it.each([
        [null, { phase: 0, card: 0 }, true],
        [{ phase: 0, card: 2 }, { phase: 0, card: 3 }, true],
        [{ phase: 0, card: 2 }, { phase: 1, card: 0 }, true],
        [{ phase: 1, card: 0 }, { phase: 0, card: 9 }, false],
        [{ phase: 0, card: 2 }, { phase: 0, card: 2 }, false],
        [null, { phase: 0, card: 60 }, false],
    ])('%j -> %j: %s', (reported, position, expected) => {
        expect(isBeyondReported(reported, position)).toBe(expected)
    })
})

describe('useCardReach', () => {
    beforeEach(() => {
        vi.mocked(useAuth).mockReturnValue({ token: 'tok' } as ReturnType<typeof useAuth>)
        vi.mocked(recordCardReach).mockReset()
        vi.mocked(recordCardReach).mockResolvedValue({ recorded: true })
    })

    it('reporta cada cartão novo uma vez, sem repetir ao voltar', () => {
        const { rerender } = renderHook(({ phase, card }) => useCardReach('l1', { phase, card }, true), {
            initialProps: { phase: 0, card: 0 },
        })
        rerender({ phase: 0, card: 1 })
        rerender({ phase: 0, card: 0 })
        rerender({ phase: 0, card: 1 })
        rerender({ phase: 1, card: 0 })

        expect(vi.mocked(recordCardReach).mock.calls.map(([, , phase, card]) => [phase, card])).toEqual([
            [0, 0],
            [0, 1],
            [1, 0],
        ])
        expect(recordCardReach).toHaveBeenCalledWith('tok', 'l1', 0, 0)
    })

    it('não reporta em revisão nem sem sessão', () => {
        renderHook(() => useCardReach('l1', { phase: 0, card: 0 }, false))
        vi.mocked(useAuth).mockReturnValue({ token: null } as ReturnType<typeof useAuth>)
        renderHook(() => useCardReach('l1', { phase: 0, card: 0 }, true))

        expect(recordCardReach).not.toHaveBeenCalled()
    })

    it('engole falha de rede', async () => {
        vi.mocked(recordCardReach).mockRejectedValue(new Error('offline'))

        expect(() => renderHook(() => useCardReach('l1', { phase: 0, card: 0 }, true))).not.toThrow()
        await Promise.resolve()
    })
})
