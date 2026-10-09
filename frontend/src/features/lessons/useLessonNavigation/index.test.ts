import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLessonNavigation } from '.'

const COUNTS = [3, 2, 2, 1]

describe('useLessonNavigation', () => {
    it('começa no passo inicial e não permite voltar do primeiro cartão do Cenário', () => {
        const { result } = renderHook(() => useLessonNavigation({ initialStep: 0, initialReached: 0 }))

        expect(result.current.canGoBack).toBe(false)
        act(() => result.current.back(COUNTS))
        expect(result.current.step).toBe(0)
        expect(result.current.card).toBe(0)
    })

    it('volta entre cartões e, no primeiro cartão, cai no último cartão da fase anterior', () => {
        const { result } = renderHook(() => useLessonNavigation({ initialStep: 0, initialReached: 0 }))

        act(() => result.current.nextCard())
        act(() => result.current.nextCard())
        act(() => result.current.goToStep(1))
        expect(result.current.step).toBe(1)
        expect(result.current.card).toBe(0)

        act(() => result.current.back(COUNTS))
        expect(result.current.step).toBe(0)
        expect(result.current.card).toBe(2)

        act(() => result.current.back(COUNTS))
        expect(result.current.card).toBe(1)
    })

    it('reached guarda a fase mais avançada mesmo depois de voltar', () => {
        const { result } = renderHook(() => useLessonNavigation({ initialStep: 0, initialReached: 0 }))

        act(() => result.current.goToStep(1))
        act(() => result.current.goToStep(2))
        act(() => result.current.back(COUNTS))
        act(() => result.current.back(COUNTS))

        expect(result.current.step).toBe(1)
        expect(result.current.reached).toBe(2)
    })

    it('reached respeita o passo já gravado no servidor', () => {
        const { result } = renderHook(() => useLessonNavigation({ initialStep: 2, initialReached: 2 }))

        act(() => result.current.back(COUNTS))
        act(() => result.current.back(COUNTS))

        expect(result.current.step).toBe(1)
        expect(result.current.reached).toBe(2)
    })

    it('cartão revelado continua revelado ao voltar', () => {
        const { result } = renderHook(() => useLessonNavigation({ initialStep: 0, initialReached: 0 }))

        act(() => result.current.reveal())
        act(() => result.current.nextCard())
        expect(result.current.isRevealed).toBe(false)

        act(() => result.current.back(COUNTS))
        expect(result.current.isRevealed).toBe(true)
    })
})
