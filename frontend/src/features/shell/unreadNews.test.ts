import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewsEvent } from '../../services/news'
import { getLastSeenNewsId, hasUnreadPendingEvent, markNewsAsSeen, subscribeToLastSeenNewsId } from './unreadNews'

function event(id: string, status: NewsEvent['status']): NewsEvent {
    return {
        id,
        title: 't',
        narrative: 'n',
        direction: 'positivo',
        magnitude_band: 'leve',
        affects_price: true,
        affects_fundamentals: false,
        status,
        triggered_on_day: 1,
        duration_days: 1,
    }
}

describe('hasUnreadPendingEvent', () => {
    it('nunca visitou (lastSeenId null) e existe pendente na lista: true', () => {
        const events = [event('3', 'aplicado'), event('2', 'pendente'), event('1', 'aplicado')]
        expect(hasUnreadPendingEvent(events, null)).toBe(true)
    })

    it('nunca visitou e não existe nenhum pendente: false', () => {
        const events = [event('2', 'aplicado'), event('1', 'aplicado')]
        expect(hasUnreadPendingEvent(events, null)).toBe(false)
    })

    it('só há pendente antes da última visita (já visto): false', () => {
        const events = [event('3', 'aplicado'), event('2', 'aplicado'), event('1', 'pendente')]
        expect(hasUnreadPendingEvent(events, '2')).toBe(false)
    })

    it('há pendente mais novo que a última visita: true', () => {
        const events = [event('3', 'pendente'), event('2', 'aplicado'), event('1', 'aplicado')]
        expect(hasUnreadPendingEvent(events, '2')).toBe(true)
    })

    it('lista vazia: false', () => {
        expect(hasUnreadPendingEvent([], null)).toBe(false)
    })
})

describe('getLastSeenNewsId / markNewsAsSeen', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('sem visita anterior, devolve null', () => {
        expect(getLastSeenNewsId()).toBeNull()
    })

    it('marca o evento mais recente (primeiro da lista) como visto', () => {
        const events = [event('3', 'pendente'), event('2', 'aplicado')]
        markNewsAsSeen(events)
        expect(getLastSeenNewsId()).toBe('3')
    })

    it('lista vazia não sobrescreve o marcador existente', () => {
        markNewsAsSeen([event('5', 'pendente')])
        markNewsAsSeen([])
        expect(getLastSeenNewsId()).toBe('5')
    })
})

describe('subscribeToLastSeenNewsId', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('notifica os inscritos quando markNewsAsSeen grava um novo marcador', () => {
        const listener = vi.fn()
        subscribeToLastSeenNewsId(listener)

        markNewsAsSeen([event('1', 'pendente')])

        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('lista vazia (marcador não muda) não notifica os inscritos', () => {
        const listener = vi.fn()
        subscribeToLastSeenNewsId(listener)

        markNewsAsSeen([])

        expect(listener).not.toHaveBeenCalled()
    })

    it('desinscrever para de receber notificações', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeToLastSeenNewsId(listener)
        unsubscribe()

        markNewsAsSeen([event('1', 'pendente')])

        expect(listener).not.toHaveBeenCalled()
    })
})
