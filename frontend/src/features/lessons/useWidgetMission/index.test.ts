import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SHOW_ME_AFTER_INTERACTIONS, SHOW_ME_AFTER_MS } from '../widgets/goal'
import type { WidgetGoal } from '../widgets/goal'
import { useWidgetMission } from '.'

const goal: WidgetGoal = { text: 't', metric: 'm', op: 'lt', value: 0, reveal: 'r' }

describe('useWidgetMission', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    function setup() {
        const onComplete = vi.fn()
        const hook = renderHook(() => useWidgetMission({ goal, outcome: undefined, onComplete }))
        return { onComplete, hook }
    }

    it('widget que já nasce no alvo não conta sem nenhuma interação', () => {
        const { onComplete, hook } = setup()
        act(() => hook.result.current.onMetrics({ m: -1 }))
        expect(onComplete).not.toHaveBeenCalled()
    })

    it('atingir o alvo depois de mexer completa de primeira', () => {
        const { onComplete, hook } = setup()
        act(() => hook.result.current.onInteraction())
        act(() => hook.result.current.onMetrics({ m: 1 }))
        expect(onComplete).not.toHaveBeenCalled()
        act(() => hook.result.current.onMetrics({ m: -1 }))
        expect(onComplete).toHaveBeenCalledWith('first-try')
    })

    it('"Me mostra" aparece com 6 interações e conta como não de primeira', () => {
        const { onComplete, hook } = setup()
        for (let i = 0; i < SHOW_ME_AFTER_INTERACTIONS - 1; i++) act(() => hook.result.current.onInteraction())
        expect(hook.result.current.showMeReady).toBe(false)
        act(() => hook.result.current.onInteraction())
        expect(hook.result.current.showMeReady).toBe(true)
        act(() => hook.result.current.showMe())
        expect(onComplete).toHaveBeenCalledWith('later')
        expect(hook.result.current.showMeRound).toBe(1)
        expect(hook.result.current.showMeReady).toBe(false)
    })

    it('"Me mostra" aparece depois de 2 minutos mexendo, e não antes', () => {
        const { hook } = setup()
        act(() => hook.result.current.onInteraction())
        act(() => void vi.advanceTimersByTime(SHOW_ME_AFTER_MS - 1))
        expect(hook.result.current.showMeReady).toBe(false)
        act(() => void vi.advanceTimersByTime(1))
        expect(hook.result.current.showMeReady).toBe(true)
    })

    it('sem interação o tempo não conta', () => {
        const { hook } = setup()
        act(() => void vi.advanceTimersByTime(SHOW_ME_AFTER_MS * 2))
        expect(hook.result.current.showMeReady).toBe(false)
    })
})
