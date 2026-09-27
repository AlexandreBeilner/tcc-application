import { describe, expect, it } from 'vitest'
import { formatDayMonth, formatDayOfMonth, formatWeekdayDate, shiftIsoDate, weekdayLong, weekdayShort } from '.'

describe('calendarFormat', () => {
    it('traduz o código de dia da semana', () => {
        expect(weekdayShort('sat')).toBe('sáb')
        expect(weekdayLong('wed')).toBe('quarta')
        expect(weekdayShort('xyz')).toBe('xyz')
    })

    it('formata dia/mês sem passar por fuso', () => {
        expect(formatDayMonth('2026-01-12')).toBe('12/01')
        expect(formatDayOfMonth('2026-01-05')).toBe('05')
        expect(formatWeekdayDate('mon', '2026-01-12')).toBe('segunda 12/01')
    })

    it('soma dias atravessando mês e ano', () => {
        expect(shiftIsoDate('2026-12-30', 3)).toBe('2027-01-02')
        expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
    })
})
