import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCalendarScope } from '.'

describe('useCalendarScope', () => {
    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    it('abre em "mine" e persiste a troca', () => {
        const { result } = renderHook(() => useCalendarScope())
        expect(result.current[0]).toBe('mine')

        act(() => result.current[1]('all'))

        expect(result.current[0]).toBe('all')
        expect(renderHook(() => useCalendarScope()).result.current[0]).toBe('all')
    })

    it('valor guardado inválido volta ao padrão', () => {
        localStorage.setItem('app.calendar.scope', 'tudo')
        expect(renderHook(() => useCalendarScope()).result.current[0]).toBe('mine')
    })

    it('sem armazenamento a escolha vale na sessão', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('bloqueado')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('bloqueado')
        })
        const { result } = renderHook(() => useCalendarScope())
        expect(result.current[0]).toBe('mine')

        act(() => result.current[1]('all'))
        expect(result.current[0]).toBe('all')
    })
})
