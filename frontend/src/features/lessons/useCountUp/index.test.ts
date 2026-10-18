import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountUp } from '.'

describe('useCountUp', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('sobe de 0 até o valor e termina exatamente nele', () => {
        const { result } = renderHook(() => useCountUp(50, 900))
        expect(result.current).toBe(0)
        act(() => {
            vi.advanceTimersByTime(450)
        })
        expect(result.current).toBeGreaterThan(0)
        expect(result.current).toBeLessThan(50)
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(result.current).toBe(50)
    })

    it('com movimento reduzido mostra o valor final de uma vez', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
        const { result } = renderHook(() => useCountUp(50))
        expect(result.current).toBe(50)
    })

    it('valor zero não anima', () => {
        const { result } = renderHook(() => useCountUp(0))
        expect(result.current).toBe(0)
    })
})
