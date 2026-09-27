import { describe, expect, it } from 'vitest'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { GetAssetBookUseCase } from './getAssetBook'

describe('GetAssetBookUseCase', () => {
  it('busca o book do ativo pelo id e userId no CatalogReader', async () => {
    const book = {
      is_sandbox: false,
      price: null,
      best_bid: 10,
      best_ask: 10.5,
      mid_price: 10.25,
      bids: [{ price: 10, quantity: 100 }],
      asks: [{ price: 10.5, quantity: 50 }],
    }
    const catalogReader = createFakeCatalogReader({ book })
    const useCase = new GetAssetBookUseCase(catalogReader)

    const result = await useCase.execute({ id: 'asset-1', userId: 'user-1' })

    expect(result).toEqual(book)
    expect(catalogReader.getAssetBookCalls).toEqual([{ id: 'asset-1', userId: 'user-1' }])
  })
})
