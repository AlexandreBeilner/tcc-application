import { describe, expect, it } from 'vitest'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { ListAssetsUseCase } from './listAssets'

describe('ListAssetsUseCase', () => {
  it('repassa o filtro type pro CatalogReader e retorna o resultado', async () => {
    const assets = [{ id: 'asset-1', ticker: 'PETR4', name: 'Petrobras', type: 'acao', is_sandbox: false }]
    const catalogReader = createFakeCatalogReader({ assets })
    const useCase = new ListAssetsUseCase(catalogReader)

    const result = await useCase.execute({ type: 'acao' })

    expect(result).toEqual(assets)
    expect(catalogReader.listAssetsCalls).toEqual(['acao'])
  })

  it('propaga erro do CatalogReader', async () => {
    const catalogReader = createFakeCatalogReader({})
    catalogReader.errorToThrow = new Error('falha no motor')
    const useCase = new ListAssetsUseCase(catalogReader)

    await expect(useCase.execute({})).rejects.toThrow('falha no motor')
  })
})
