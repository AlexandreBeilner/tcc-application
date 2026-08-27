import { beforeEach, describe, expect, it } from 'vitest'
import type { NewsEvent } from '../api/news'
import { getLastSeenNewsId, hasUnreadPendingEvent, markNewsAsSeen } from './unreadNews'

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
