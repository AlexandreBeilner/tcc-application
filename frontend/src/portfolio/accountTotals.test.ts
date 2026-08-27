import { describe, expect, it } from 'vitest'
import { calculateAccountTotals } from './accountTotals'

describe('calculateAccountTotals', () => {
  it('separa investido em mercado ao vivo e sandbox pela flag isSandbox', () => {
    const totals = calculateAccountTotals(
      [
        { isSandbox: false, quantity: 10, averagePrice: 10 }, // 100
        { isSandbox: true, quantity: 5, averagePrice: 20 }, // 100
      ],
      [{ isSandbox: false, quantity: 1, averagePrice: 50 }], // 50
    )

    expect(totals).toEqual({ liveInvested: 150, sandboxInvested: 100 })
  })

  it('sem posições devolve zero nos dois totais', () => {
    expect(calculateAccountTotals([], [])).toEqual({ liveInvested: 0, sandboxInvested: 0 })
  })
})
