import { describe, expect, it } from 'vitest'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { GetAssetQuotesUseCase } from './getAssetQuotes'

describe('GetAssetQuotesUseCase', () => {
  it('repassa id e days pro CatalogReader', async () => {
    const quotes = [{ simulated_day: 1, price: 100 }]
    const catalogReader = createFakeCatalogReader({ quotes })
    const useCase = new GetAssetQuotesUseCase(catalogReader)

    const result = await useCase.execute({ id: 'asset-1', days: 7 })

    expect(result).toEqual(quotes)
    expect(catalogReader.getAssetQuotesCalls).toEqual([{ id: 'asset-1', days: 7 }])
  })
})
