import { describe, expect, it } from 'vitest'
import { EQUITY_ASSET_TYPES } from '../domain/assetTypes'
import { ProductLockedError } from '../domain/errors'
import { createFakeCatalogReader } from '../test/fakes/fakeCatalogReader'
import { createFakeProductUnlockReader } from '../test/fakes/fakeProductUnlockReader'
import type { AssetDetail } from './ports/catalogReader'
import { assertProductUnlocked } from './productUnlockGate'

const equityAsset: AssetDetail = {
  id: 'asset-1',
  ticker: 'VALR3',
  name: 'Vale do Rio',
  type: 'acao',
  is_sandbox: false,
}

describe('assertProductUnlocked', () => {
  it('não lança quando a chave já está desbloqueada', async () => {
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set(['asset:acao']) })

    await expect(
      assertProductUnlocked(catalogReader, productUnlockReader, 'asset-1', 'user-1', EQUITY_ASSET_TYPES),
    ).resolves.toBeUndefined()
  })

  it('não checa desbloqueio pra ativo sandbox (RF12)', async () => {
    const catalogReader = createFakeCatalogReader({ asset: { ...equityAsset, is_sandbox: true } })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })

    await assertProductUnlocked(catalogReader, productUnlockReader, 'asset-1', 'user-1', EQUITY_ASSET_TYPES)

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
  })

  it('não checa desbloqueio quando o tipo do ativo não é relevante pro endpoint chamador', async () => {
    const catalogReader = createFakeCatalogReader({ asset: { ...equityAsset, type: 'cdb' } })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })

    await assertProductUnlocked(catalogReader, productUnlockReader, 'asset-1', 'user-1', EQUITY_ASSET_TYPES)

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
  })

  it('lança ProductLockedError, citando a lição que desbloqueia, quando a chave não está no conjunto', async () => {
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const productUnlockReader = createFakeProductUnlockReader({
      unlockedKeys: new Set(),
      lessonHint: { code: '2.3', title: 'Nomenclatura de tickers' },
    })

    await expect(
      assertProductUnlocked(catalogReader, productUnlockReader, 'asset-1', 'user-1', EQUITY_ASSET_TYPES),
    ).rejects.toThrow(ProductLockedError)
  })
})
