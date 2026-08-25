import { describe, expect, it } from 'vitest'
import { profitabilityPct } from './profitability'

describe('profitabilityPct', () => {
  it('ganho positivo', () => {
    expect(profitabilityPct(10000, 11000)).toBeCloseTo(10)
  })

  it('perda', () => {
    expect(profitabilityPct(10000, 9000)).toBeCloseTo(-10)
  })

  it('sem variação', () => {
    expect(profitabilityPct(10000, 10000)).toBe(0)
  })

  it('baseline zero não gera Infinity/NaN', () => {
    expect(profitabilityPct(0, 500)).toBe(0)
  })
})
