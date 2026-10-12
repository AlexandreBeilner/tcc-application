import { describe, expect, it } from 'vitest'
import { GetAssetPriceSeriesUseCase } from './getAssetPriceSeries'
import type { AssetPriceSeriesReader } from '../ports/assetPriceSeriesReader'

function spyReader() {
  const calls: number[] = []
  const reader: AssetPriceSeriesReader = {
    async getRecentPrices(days) {
      calls.push(days)
      return { a: [1, 2, 3] }
    },
  }
  return { reader, calls }
}

describe('GetAssetPriceSeriesUseCase', () => {
  it('usa 30 dias quando days não vem', async () => {
    const { reader, calls } = spyReader()
    const result = await new GetAssetPriceSeriesUseCase(reader).execute({})
    expect(calls).toEqual([30])
    expect(result).toEqual({ a: [1, 2, 3] })
  })

  it('repassa days informado', async () => {
    const { reader, calls } = spyReader()
    await new GetAssetPriceSeriesUseCase(reader).execute({ days: 7 })
    expect(calls).toEqual([7])
  })
})
