import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useClientPagination } from '.'

describe('useClientPagination', () => {
    it('fatia a página 1 por padrão', () => {
        const items = Array.from({ length: 25 }, (_, index) => index)
        const { result } = renderHook(() => useClientPagination(items, 10))

        expect(result.current.page).toBe(1)
        expect(result.current.totalPages).toBe(3)
        expect(result.current.pageItems).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it('troca de página via setPage', () => {
        const items = Array.from({ length: 25 }, (_, index) => index)
        const { result } = renderHook(() => useClientPagination(items, 10))

        act(() => result.current.setPage(2))

        expect(result.current.page).toBe(2)
        expect(result.current.pageItems).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
    })

    it('clampa a página quando a lista encolhe (ex: troca de aba) sem esperar resetPage', () => {
        const { result, rerender } = renderHook(({ items }) => useClientPagination(items, 10), {
            initialProps: { items: Array.from({ length: 25 }, (_, index) => index) },
        })

        act(() => result.current.setPage(3))
        expect(result.current.page).toBe(3)

        rerender({ items: [0, 1, 2] })

        expect(result.current.page).toBe(1)
        expect(result.current.pageItems).toEqual([0, 1, 2])
    })

    it('resetPage volta pra página 1', () => {
        const items = Array.from({ length: 25 }, (_, index) => index)
        const { result } = renderHook(() => useClientPagination(items, 10))

        act(() => result.current.setPage(3))
        act(() => result.current.resetPage())

        expect(result.current.page).toBe(1)
    })
})
