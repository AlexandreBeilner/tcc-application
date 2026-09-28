import { describe, expect, it } from 'vitest'
import { addMonths, monthKeyOf, monthsBetween } from './monthKey'

describe('monthKeyOf', () => {
  it('extrai YYYY-MM de uma data YYYY-MM-DD', () => {
    expect(monthKeyOf('2026-09-27')).toBe('2026-09')
  })
})

describe('addMonths', () => {
  it('soma dentro do mesmo ano', () => {
    expect(addMonths('2026-01', 3)).toBe('2026-04')
  })

  it('vira o ano ao somar além de dezembro', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01')
  })

  it('delta zero devolve o mesmo mês', () => {
    expect(addMonths('2026-09', 0)).toBe('2026-09')
  })
})

describe('monthsBetween', () => {
  it('mesmo mês dá 0', () => {
    expect(monthsBetween('2026-09', '2026-09')).toBe(0)
  })

  it('meses dentro do mesmo ano', () => {
    expect(monthsBetween('2026-06', '2026-09')).toBe(3)
  })

  it('virada de ano', () => {
    expect(monthsBetween('2026-11', '2027-01')).toBe(2)
  })
})
