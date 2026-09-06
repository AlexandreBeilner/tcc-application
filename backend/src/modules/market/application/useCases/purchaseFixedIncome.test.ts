import { describe, expect, it } from 'vitest'
import { ProductLockedError } from '../../domain/errors'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { createFakeFixedIncomeExecutor } from '../../test/fakes/fakeFixedIncomeExecutor'
import { createFakeProductUnlockReader } from '../../test/fakes/fakeProductUnlockReader'
import type { AssetDetail } from '../ports/catalogReader'
import { PurchaseFixedIncomeUseCase } from './purchaseFixedIncome'

const tesouroSelicAsset: AssetDetail = {
  id: 'asset-1',
  ticker: 'LFT2029',
  name: 'Tesouro Selic 2029',
  type: 'tesouro_selic',
  is_sandbox: false,
}

const sandboxAsset: AssetDetail = {
  ...tesouroSelicAsset,
  id: 'sand-1',
  ticker: 'SANDPRE',
  is_sandbox: true,
}

const input = { user_id: 'user-1', asset_id: 'asset-1', amount: 1000 }

describe('PurchaseFixedIncomeUseCase', () => {
  it('repassa o aporte pro FixedIncomeExecutor quando o produto já está desbloqueado', async () => {
    const result = {
      unit_price: 950.2,
      quantity_purchased: 1.052,
      position: { quantity: 1.052, average_price: 950.2, average_rate: 0.11 },
    }
    const fixedIncomeExecutor = createFakeFixedIncomeExecutor({ purchase: result })
    const catalogReader = createFakeCatalogReader({ asset: tesouroSelicAsset })
    const productUnlockReader = createFakeProductUnlockReader({
      unlockedKeys: new Set(['asset:tesouro_selic']),
    })
    const useCase = new PurchaseFixedIncomeUseCase(
      fixedIncomeExecutor,
      catalogReader,
      productUnlockReader,
    )

    const response = await useCase.execute(input)

    expect(response).toEqual(result)
    expect(fixedIncomeExecutor.purchaseCalls).toEqual([input])
  })

  it('repassa direto sem checar desbloqueio quando o produto é sandbox (RF12)', async () => {
    const fixedIncomeExecutor = createFakeFixedIncomeExecutor({
      purchase: {
        unit_price: 1,
        quantity_purchased: 1,
        position: { quantity: 1, average_price: 1, average_rate: 0 },
      },
    })
    const catalogReader = createFakeCatalogReader({ asset: sandboxAsset })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })
    const useCase = new PurchaseFixedIncomeUseCase(
      fixedIncomeExecutor,
      catalogReader,
      productUnlockReader,
    )

    await useCase.execute({ ...input, asset_id: 'sand-1' })

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
    expect(fixedIncomeExecutor.purchaseCalls).toHaveLength(1)
  })

  it('rejeita com ProductLockedError quando a chave não está no conjunto do usuário', async () => {
    const fixedIncomeExecutor = createFakeFixedIncomeExecutor({})
    const catalogReader = createFakeCatalogReader({ asset: tesouroSelicAsset })
    const productUnlockReader = createFakeProductUnlockReader({
      unlockedKeys: new Set(),
      lessonHint: { code: '1.2', title: 'Tesouro Selic' },
    })
    const useCase = new PurchaseFixedIncomeUseCase(
      fixedIncomeExecutor,
      catalogReader,
      productUnlockReader,
    )

    await expect(useCase.execute(input)).rejects.toThrow(ProductLockedError)
    expect(fixedIncomeExecutor.purchaseCalls).toEqual([])
  })
})
