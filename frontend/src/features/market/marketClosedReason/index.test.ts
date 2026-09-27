import { describe, expect, it } from 'vitest'
import type { MarketClock } from '../../../services/market'
import { describeMarketClosed } from '.'

const saturday: MarketClock = {
    simulated_day: 5,
    date: '2026-01-10',
    weekday: 'sat',
    market_open: false,
    days_until_open: 2,
    days_per_real_day: 5,
    next_tick_at: '2026-01-10T04:48:00Z',
    quarter_day: 5,
    quarter_length: 91,
}

describe('describeMarketClosed', () => {
    it('devolve null com o mercado aberto', () => {
        expect(describeMarketClosed({ ...saturday, market_open: true, days_until_open: 0 })).toBeNull()
    })

    it('sábado: reabre no próximo tick mais um intervalo (4h48), segunda 12/01', () => {
        // agora = 00:36; próximo tick 04:48 (em 4h12) + 4h48 do domingo = 9h00
        const now = new Date('2026-01-10T00:36:00Z')
        expect(describeMarketClosed(saturday, now)).toBe('Mercado fechado: fim de semana simulado. Abre em 9h00, segunda 12/01')
    })

    it('domingo: reabre no próximo tick, segunda 12/01', () => {
        const sunday = { ...saturday, simulated_day: 6, date: '2026-01-11', weekday: 'sun', days_until_open: 1 }
        const now = new Date('2026-01-10T00:36:00Z')
        expect(describeMarketClosed(sunday, now)).toBe('Mercado fechado: fim de semana simulado. Abre em 4h12, segunda 12/01')
    })

    it('sem agenda automática (next_tick_at nulo), omite o tempo restante', () => {
        expect(describeMarketClosed({ ...saturday, next_tick_at: null })).toBe(
            'Mercado fechado: fim de semana simulado. Abre segunda 12/01',
        )
    })

    it('menos de uma hora mostra só minutos', () => {
        const sunday = { ...saturday, date: '2026-01-11', weekday: 'sun', days_until_open: 1 }
        expect(describeMarketClosed(sunday, new Date('2026-01-10T04:18:00Z'))).toBe(
            'Mercado fechado: fim de semana simulado. Abre em 30min, segunda 12/01',
        )
    })
})
