import { describe, expect, it } from 'vitest'
import { addDays, isCohortMatured, retentionCell, weekStart } from './retention'

describe('weekStart', () => {
  it.each([
    ['2026-10-12', '2026-10-12'], // segunda-feira
    ['2026-10-13', '2026-10-12'],
    ['2026-10-18', '2026-10-12'], // domingo fecha a semana
    ['2026-10-19', '2026-10-19'],
    ['2026-01-01', '2025-12-29'], // atravessa o ano
    ['2024-03-01', '2024-02-26'], // atravessa fevereiro bissexto
  ])('%s cai na semana que começa em %s', (day, expected) => {
    expect(weekStart(day)).toBe(expected)
  })
})

describe('addDays', () => {
  it('soma e subtrai dias no calendário UTC, sem depender do fuso', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
  })
})

describe('retentionCell', () => {
  const counts = (open: number, beforeTracking: number, measurable: number, active: number) => ({
    open,
    beforeTracking,
    measurable,
    active,
  })

  it('toda a coorte medida: completa, com a taxa', () => {
    expect(retentionCell(200, counts(0, 0, 200, 50))).toEqual({
      status: 'complete',
      rate: 0.25,
      measured: 200,
      size: 200,
    })
  })

  it('coorte que ainda não chegou ao dia N é em andamento, nunca zero', () => {
    expect(retentionCell(40, counts(40, 0, 0, 0))).toEqual({
      status: 'in_progress',
      rate: null,
      measured: 0,
      size: 40,
    })
  })

  it('coorte anterior ao registro é sem dado, nunca zero', () => {
    expect(retentionCell(40, counts(0, 40, 0, 0))).toMatchObject({ status: 'no_data', rate: null })
  })

  it('metade já medida, metade ainda aberta: parcial, com a taxa de quem foi medido', () => {
    expect(retentionCell(10, counts(5, 0, 5, 1))).toEqual({
      status: 'partial',
      rate: 0.2,
      measured: 5,
      size: 10,
    })
  })

  it('zero que voltaram entre os medidos é taxa 0, diferente de sem medida', () => {
    expect(retentionCell(10, counts(0, 0, 10, 0))).toMatchObject({ status: 'complete', rate: 0 })
  })
})

describe('isCohortMatured', () => {
  it('só amadurece 30 dias depois do último dia da semana de cadastro', () => {
    // Semana de 2026-09-07 a 2026-09-13; +30 dias = 2026-10-13.
    expect(isCohortMatured('2026-09-07', '2026-10-13')).toBe(false)
    expect(isCohortMatured('2026-09-07', '2026-10-14')).toBe(true)
  })
})
