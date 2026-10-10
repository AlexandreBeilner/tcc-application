import { describe, expect, it } from 'vitest'
import { isNearWindowStart, monthWindow, weekWindow } from './window'

describe('weekWindow', () => {
  it('segunda-feira 10:00 UTC: janela começa nessa mesma segunda 00:00', () => {
    const window = weekWindow(new Date('2026-08-24T10:00:00.000Z')) // segunda

    expect(window.start.toISOString()).toBe('2026-08-24T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-08-30T23:59:59.999Z')
  })

  it('domingo 23:59:59.999 UTC ainda pertence à semana que termina nesse domingo', () => {
    const window = weekWindow(new Date('2026-08-30T23:59:59.999Z')) // domingo

    expect(window.start.toISOString()).toBe('2026-08-24T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-08-30T23:59:59.999Z')
  })

  it('segunda 00:00:00.000 UTC já vira a semana seguinte — a virada é exata', () => {
    const window = weekWindow(new Date('2026-08-31T00:00:00.000Z')) // segunda seguinte

    expect(window.start.toISOString()).toBe('2026-08-31T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-09-06T23:59:59.999Z')
  })

  it('quarta-feira cai no meio da mesma janela semanal', () => {
    const window = weekWindow(new Date('2026-08-26T15:30:00.000Z')) // quarta

    expect(window.start.toISOString()).toBe('2026-08-24T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-08-30T23:59:59.999Z')
  })
})

describe('monthWindow', () => {
  it('meio do mês: janela cobre o mês calendário inteiro', () => {
    const window = monthWindow(new Date('2026-08-15T12:00:00.000Z'))

    expect(window.start.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-08-31T23:59:59.999Z')
  })

  it('último instante do mês ainda pertence a ele — a virada é exata', () => {
    const window = monthWindow(new Date('2026-08-31T23:59:59.999Z'))

    expect(window.start.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-08-31T23:59:59.999Z')
  })

  it('primeiro instante do mês seguinte já vira a próxima janela', () => {
    const window = monthWindow(new Date('2026-09-01T00:00:00.000Z'))

    expect(window.start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-09-30T23:59:59.999Z')
  })

  it('fevereiro (mês curto) fecha corretamente em ano não bissexto', () => {
    const window = monthWindow(new Date('2027-02-10T00:00:00.000Z'))

    expect(window.end.toISOString()).toBe('2027-02-28T23:59:59.999Z')
  })
})

describe('isNearWindowStart', () => {
  it.each([
    ['segunda 00:30 UTC: começo da semana', '2026-08-24T00:30:00.000Z', true],
    ['segunda 03:59 UTC: ainda dentro da tolerância', '2026-08-24T03:59:00.000Z', true],
    ['segunda 04:00 UTC: fora da tolerância', '2026-08-24T04:00:00.000Z', false],
    ['dia 1 às 01:00 UTC: começo do mês', '2026-09-01T01:00:00.000Z', true],
    ['quarta 12:00 UTC: meio da semana', '2026-08-26T12:00:00.000Z', false],
  ])('%s', (_name, iso, expected) => {
    expect(isNearWindowStart(new Date(iso))).toBe(expected)
  })
})
