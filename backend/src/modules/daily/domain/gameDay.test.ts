import { describe, expect, it } from 'vitest'
import { todayUtc } from '../../gamification/domain/streak'
import {
  addDays,
  dailyDay,
  gameDateFor,
  gameNumberFor,
  isDateKey,
  resolveGameAccess,
  resolveStatus,
} from './gameDay'

describe('dailyDay', () => {
  // Brasília é UTC-3: 20h59 BRT = 23h59 UTC; 21h00 BRT = 00h00 UTC do dia seguinte.
  it.each([
    ['20h59 de Brasília', '2026-11-03T23:59:00Z', '2026-11-03'],
    ['21h00 de Brasília', '2026-11-04T00:00:00Z', '2026-11-04'],
    ['meia-noite de Brasília', '2026-11-04T03:00:00Z', '2026-11-04'],
  ])('%s: mesmo dia do streak', (_label, instant, expected) => {
    const now = new Date(instant)
    expect(dailyDay(now)).toBe(expected)
    expect(dailyDay(now)).toBe(todayUtc(now))
  })
})

describe('resolveStatus', () => {
  it.each([
    [null, '2026-11-01', { status: 'off' }],
    ['2026-11-03', '2026-11-02', { status: 'scheduled', startDate: '2026-11-03' }],
    ['2026-11-03', '2026-11-03', { status: 'live', startDate: '2026-11-03' }],
    ['2026-11-03', '2026-12-01', { status: 'live', startDate: '2026-11-03' }],
  ])('estreia %s, hoje %s', (start, today, expected) => {
    expect(resolveStatus(start, today)).toEqual(expected)
  })
})

describe('numeração', () => {
  it.each([
    ['2026-11-03', '2026-11-02', null],
    ['2026-11-03', '2026-11-03', 1],
    ['2026-11-03', '2026-11-04', 2],
    ['2026-11-03', '2026-12-01', 29],
    ['2026-12-30', '2027-01-02', 4],
  ])('estreia %s, dia %s => #%s', (start, day, expected) => {
    expect(gameNumberFor(start, day)).toBe(expected)
  })

  it('gameDateFor é a inversa de gameNumberFor', () => {
    for (const n of [1, 2, 30, 365]) {
      expect(gameNumberFor('2026-11-03', gameDateFor('2026-11-03', n))).toBe(n)
    }
  })

  it('addDays cruza mês e ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('isDateKey recusa formato e data inexistentes', () => {
    expect(isDateKey('2026-11-03')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('03/11/2026')).toBe(false)
  })
})

describe('resolveGameAccess', () => {
  it('desligado: nada acessível', () => {
    expect(resolveGameAccess(null, '2026-11-03', 1)).toEqual({ kind: 'off' })
  })

  it('antes da estreia: nada acessível, devolve a data', () => {
    expect(resolveGameAccess('2026-11-05', '2026-11-03', 1)).toEqual({
      kind: 'not_started',
      startDate: '2026-11-05',
    })
  })

  it('no dia da estreia: só o #1', () => {
    expect(resolveGameAccess('2026-11-03', '2026-11-03', 1)).toEqual({
      kind: 'ok',
      number: 1,
      date: '2026-11-03',
      isToday: true,
      awardsXp: true,
    })
    expect(resolveGameAccess('2026-11-03', '2026-11-03', 2)).toEqual({ kind: 'not_found' })
  })

  it('dia anterior é acessível mas não vale XP', () => {
    expect(resolveGameAccess('2026-11-03', '2026-11-10', 3)).toEqual({
      kind: 'ok',
      number: 3,
      date: '2026-11-05',
      isToday: false,
      awardsXp: false,
    })
  })

  it.each([0, -1, 9, 1.5, Number.NaN])('número %s é inexistente', (n) => {
    expect(resolveGameAccess('2026-11-03', '2026-11-10', n)).toEqual({ kind: 'not_found' })
  })

  it('número futuro recusado nos dois lados da virada das 21h de Brasília', () => {
    for (const instant of ['2026-11-09T23:59:00Z', '2026-11-10T00:00:00Z']) {
      const today = dailyDay(new Date(instant))
      const todayNumber = gameNumberFor('2026-11-03', today) as number
      expect(resolveGameAccess('2026-11-03', today, todayNumber).kind).toBe('ok')
      expect(resolveGameAccess('2026-11-03', today, todayNumber + 1)).toEqual({ kind: 'not_found' })
    }
  })
})
