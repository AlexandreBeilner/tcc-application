import { describe, expect, it } from 'vitest'
import type { MarketClock } from '../../../services/market'
import { quarterCells } from '.'

const clock: MarketClock = {
    simulated_day: 135,
    date: '2026-07-08',
    weekday: 'wed',
    market_open: true,
    days_until_open: 0,
    days_per_real_day: 5,
    next_tick_at: null,
    quarter_day: 44,
    quarter_length: 91,
}

describe('quarterCells', () => {
    const cells = quarterCells(clock)

    it('cobre o trimestre inteiro, do primeiro ao último dia', () => {
        expect(cells).toHaveLength(91)
        expect(cells[0].simulatedDay).toBe(92)
        expect(cells[90].simulatedDay).toBe(182)
        expect(cells[43]).toMatchObject({ simulatedDay: 135, date: '2026-07-08', weekday: 'wed' })
    })

    it('marca fim de semana como fechado e só o último dia como relatório', () => {
        const saturday = cells.find((cell) => cell.weekday === 'sat')
        expect(saturday?.open).toBe(false)
        expect(cells.filter((cell) => cell.isReportDay)).toEqual([cells[90]])
    })
})
