import { describe, expect, it } from 'vitest'
import { formatCohortWeek, formatDay, formatMilestoneTime, formatRetentionRate, retentionBand, retentionCellText } from '.'

describe('retentionFormat', () => {
    it('taxa em porcentagem com uma casa e vírgula', () => {
        expect(formatRetentionRate(0.2345)).toBe('23,5%')
        expect(formatRetentionRate(0)).toBe('0,0%')
        expect(formatRetentionRate(null)).toBe('sem dado')
    })

    it.each([
        ['d1', 0.4, 'good'],
        ['d1', 0.3, 'ok'],
        ['d1', 0.2499, 'low'],
        ['d7', 0.2, 'good'],
        ['d7', 0.12, 'ok'],
        ['d7', 0.11, 'low'],
        ['d30', 0.1, 'good'],
        ['d30', 0.05, 'ok'],
        ['d30', 0.049, 'low'],
    ] as const)('faixa de %s com %s é %s', (day, rate, expected) => {
        expect(retentionBand(day, rate)).toBe(expected)
    })

    it('em andamento e sem dado têm texto próprio e nunca viram 0%', () => {
        const cell = { rate: null, measured: 0, size: 10 }
        expect(retentionCellText({ ...cell, status: 'in_progress' })).toBe('em andamento')
        expect(retentionCellText({ ...cell, status: 'no_data' })).toBe('sem dado')
        expect(retentionCellText({ status: 'complete', rate: 0, measured: 10, size: 10 })).toBe('0,0%')
    })

    it('datas em UTC, sem escorregar de dia pelo fuso do navegador', () => {
        expect(formatDay('2026-10-12')).toBe('12/10')
        expect(formatCohortWeek('2026-10-12')).toBe('12/10 a 18/10')
        expect(formatCohortWeek('2026-12-28')).toBe('28/12 a 03/01')
    })

    it.each([
        [{ median_seconds: null, granularity: 'second' as const }, 'sem dado'],
        [{ median_seconds: 90, granularity: 'second' as const }, '2 min'],
        [{ median_seconds: 5 * 3600, granularity: 'second' as const }, '5 h'],
        [{ median_seconds: 25.5 * 3600, granularity: 'second' as const }, '25,5 h'],
        [{ median_seconds: 3 * 86_400, granularity: 'second' as const }, '3 dias'],
        [{ median_seconds: 86_400, granularity: 'day' as const }, '1 dia'],
        [{ median_seconds: 4 * 86_400, granularity: 'day' as const }, '4 dias'],
    ])('tempo até o marco %j é %s', (item, expected) => {
        expect(formatMilestoneTime(item)).toBe(expected)
    })
})
