import { describe, expect, it } from 'vitest'
import type { MarketClock } from '../../../services/market'
import { clockProgress, simulatedDayDurationMs } from '.'

const NEXT_TICK = '2026-01-05T12:00:00Z'
const HOUR = 3_600_000

function clock(overrides: Partial<MarketClock> = {}): MarketClock {
    return {
        simulated_day: 3,
        date: '2026-01-08',
        weekday: 'thu',
        market_open: true,
        days_until_open: 0,
        days_per_real_day: 5,
        next_tick_at: NEXT_TICK,
        quarter_day: 3,
        quarter_length: 91,
        ...overrides,
    }
}

describe('clockProgress', () => {
    const next = new Date(NEXT_TICK).getTime()
    const interval = (24 * HOUR) / 5

    it.each([
        ['início do dia (falta o intervalo inteiro)', next - interval, 0],
        ['meio do dia', next - interval / 2, 0.5],
        ['fim do dia (o tick chegou)', next, 1],
        ['depois do fim (tick atrasado)', next + HOUR, 1],
        ['antes do início (relógio do navegador defasado)', next - interval - HOUR, 0],
    ])('%s', (_label, nowMs, expected) => {
        expect(clockProgress(clock(), new Date(nowMs))).toBeCloseTo(expected, 5)
    })

    it('devolve null sem next_tick_at (agenda desligada)', () => {
        expect(clockProgress(clock({ next_tick_at: null }), new Date(next))).toBeNull()
    })

    it('a duração do dia simulado segue o fator', () => {
        expect(simulatedDayDurationMs({ days_per_real_day: 5 })).toBe(4.8 * HOUR)
        expect(simulatedDayDurationMs({ days_per_real_day: 1 })).toBe(24 * HOUR)
    })
})
