import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActiveAnnouncement } from '../../../services/announcements'
import { readDismissedIds, visibleAnnouncements } from '.'

const make = (id: string, dismissible: boolean): ActiveAnnouncement => ({
    id,
    title: id,
    body: 'x',
    severity: 'info',
    kind: 'notice',
    dismissible,
    starts_at: '2026-10-06T10:00:00Z',
    ends_at: null,
})

describe('visibleAnnouncements', () => {
    it('some o que foi dispensado e mantém o resto', () => {
        const result = visibleAnnouncements([make('a', true), make('b', true)], ['a'])
        expect(result.map((a) => a.id)).toEqual(['b'])
    })

    it('aviso não dispensável continua visível mesmo com o id na lista', () => {
        expect(visibleAnnouncements([make('m', false)], ['m'])).toHaveLength(1)
    })
})

describe('readDismissedIds', () => {
    afterEach(() => {
        sessionStorage.clear()
        vi.restoreAllMocks()
    })

    it('lê a lista guardada na sessão', () => {
        sessionStorage.setItem('dismissedAnnouncements', '["a","b"]')
        expect(readDismissedIds()).toEqual(['a', 'b'])
    })

    it('valor corrompido ou de tipo errado vira lista vazia', () => {
        sessionStorage.setItem('dismissedAnnouncements', '{not json')
        expect(readDismissedIds()).toEqual([])
        sessionStorage.setItem('dismissedAnnouncements', '{"a":1}')
        expect(readDismissedIds()).toEqual([])
    })

    it('storage que lança no acesso não quebra', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('bloqueado')
        })
        expect(readDismissedIds()).toEqual([])
    })
})
