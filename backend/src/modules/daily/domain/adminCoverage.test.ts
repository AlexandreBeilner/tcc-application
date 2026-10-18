import { describe, expect, it } from 'vitest'
import { addToTally, consecutiveDaysFrom, emptyTally } from './adminCoverage'

describe('consecutiveDaysFrom', () => {
  const day = (gameDate: string, ok: boolean) => ({ gameDate, ok })

  it('conta só os dias seguidos a partir da data', () => {
    const days = [day('2026-11-01', true), day('2026-11-02', true), day('2026-11-03', true)]
    expect(consecutiveDaysFrom('2026-11-01', days)).toBe(3)
  })

  it('para no primeiro dia não revisado', () => {
    const days = [day('2026-11-01', true), day('2026-11-02', false), day('2026-11-03', true)]
    expect(consecutiveDaysFrom('2026-11-01', days)).toBe(1)
  })

  it('para num buraco da agenda', () => {
    const days = [day('2026-11-01', true), day('2026-11-03', true)]
    expect(consecutiveDaysFrom('2026-11-01', days)).toBe(1)
  })

  it('é zero se o primeiro dia não existe', () => {
    expect(consecutiveDaysFrom('2026-11-01', [day('2026-11-02', true)])).toBe(0)
  })
})

describe('addToTally', () => {
  it('soma por marcador e por categoria', () => {
    const tally = emptyTally()
    addToTally(tally, { category: 'juros-e-inflacao', scope: 'brasil' })
    addToTally(tally, { category: 'juros-e-inflacao', scope: 'fora' })
    addToTally(tally, { category: 'instituicoes', scope: 'brasil' })
    expect(tally).toEqual({
      total: 3,
      brasil: 2,
      fora: 1,
      byCategory: { 'juros-e-inflacao': 2, instituicoes: 1 },
    })
  })
})
