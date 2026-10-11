import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSeenAssemblyIds, hasUnseenAssembly, markAssembliesSeen, subscribeToSeenAssemblies } from '.'

describe('unreadAssemblies', () => {
    beforeEach(() => localStorage.clear())

    it('acende só para assembleia aberta ainda não vista', () => {
        expect(hasUnseenAssembly([], [])).toBe(false)
        expect(hasUnseenAssembly(['a'], [])).toBe(true)
        expect(hasUnseenAssembly(['a'], ['a'])).toBe(false)
        expect(hasUnseenAssembly(['a', 'b'], ['a'])).toBe(true)
    })

    it('lembra o que foi visto, junta com o anterior e avisa quem escuta', () => {
        const listener = vi.fn()
        const stop = subscribeToSeenAssemblies(listener)
        markAssembliesSeen(['a'])
        markAssembliesSeen(['a', 'b'])
        expect(getSeenAssemblyIds()).toEqual(['a', 'b'])
        expect(listener).toHaveBeenCalledTimes(2)
        stop()
        markAssembliesSeen(['c'])
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('não grava nada para lista vazia e ignora valor corrompido', () => {
        markAssembliesSeen([])
        expect(localStorage.length).toBe(0)
        localStorage.setItem('app.assemblies.seen', '{nao-e-json')
        expect(getSeenAssemblyIds()).toEqual([])
    })

    it('guarda no máximo as 100 mais recentes', () => {
        markAssembliesSeen(Array.from({ length: 120 }, (_, i) => `id-${i}`))
        const seen = getSeenAssemblyIds()
        expect(seen).toHaveLength(100)
        expect(seen[0]).toBe('id-20')
    })
})
