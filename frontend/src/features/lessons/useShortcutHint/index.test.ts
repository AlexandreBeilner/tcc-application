import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShortcutHint } from '.'

const KEY = 'selucra:lesson-shortcut-hint-seen'

function stubMatchMedia(matches: boolean) {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }))
}

describe('useShortcutHint', () => {
    beforeEach(() => window.localStorage.clear())
    afterEach(() => vi.unstubAllGlobals())

    it('mostra uma vez no desktop (mouse e teclado) e grava que viu', () => {
        stubMatchMedia(true)

        const first = renderHook(() => useShortcutHint(true))
        expect(first.result.current).toBe(true)
        expect(window.localStorage.getItem(KEY)).toBe('1')

        // Na próxima lição (remonta) já não aparece.
        const second = renderHook(() => useShortcutHint(true))
        expect(second.result.current).toBe(false)
    })

    it('no celular (sem mouse) nunca aparece nem grava', () => {
        stubMatchMedia(false)

        const { result } = renderHook(() => useShortcutHint(true))

        expect(result.current).toBe(false)
        expect(window.localStorage.getItem(KEY)).toBeNull()
    })

    it('só grava depois de a dica de fato aparecer (lição ainda carregando não gasta a dica)', () => {
        stubMatchMedia(true)

        const { result, rerender } = renderHook(({ visible }) => useShortcutHint(visible), { initialProps: { visible: false } })
        expect(result.current).toBe(false)
        expect(window.localStorage.getItem(KEY)).toBeNull()

        rerender({ visible: true })
        expect(result.current).toBe(true)
        expect(window.localStorage.getItem(KEY)).toBe('1')
    })

    it('armazenamento bloqueado não derruba: a dica some em silêncio', () => {
        stubMatchMedia(true)
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('bloqueado')
        })

        const { result } = renderHook(() => useShortcutHint(true))

        expect(result.current).toBe(false)
        vi.restoreAllMocks()
    })
})
