import { describe, expect, it } from 'vitest'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { GetAssetUseCase } from './getAsset'

describe('GetAssetUseCase', () => {
  it('busca o ativo pelo id no CatalogReader', async () => {
    const asset = {
      id: 'asset-1',
      ticker: 'PETR4',
      name: 'Petrobras',
      type: 'acao',
      is_sandbox: false,
    }
    const catalogReader = createFakeCatalogReader({ asset })
    const useCase = new GetAssetUseCase(catalogReader)

    const result = await useCase.execute({ id: 'asset-1' })

    expect(result).toEqual(asset)
    expect(catalogReader.getAssetCalls).toEqual(['asset-1'])
  })
})
