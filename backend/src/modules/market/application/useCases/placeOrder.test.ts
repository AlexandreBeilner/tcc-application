import { describe, expect, it } from 'vitest'
import { ProductLockedError } from '../../domain/errors'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { createFakeOrderExecutor } from '../../test/fakes/fakeOrderExecutor'
import { createFakeProductUnlockReader } from '../../test/fakes/fakeProductUnlockReader'
import type { AssetDetail } from '../ports/catalogReader'
import { PlaceOrderUseCase } from './placeOrder'

const equityAsset: AssetDetail = {
  id: 'asset-1',
  ticker: 'VALR3',
  name: 'Vale do Rio',
  type: 'acao',
  is_sandbox: false,
}

const sandboxAsset: AssetDetail = {
  ...equityAsset,
  id: 'sand-1',
  ticker: 'SAND3',
  is_sandbox: true,
}

const input = {
  user_id: 'user-1',
  asset_id: 'asset-1',
  side: 'buy' as const,
  type: 'market' as const,
  quantity: 10,
}

describe('PlaceOrderUseCase', () => {
  it('repassa a ordem pro OrderExecutor quando o ativo já está desbloqueado', async () => {
    const result = { filled_quantity: 10, remaining_quantity: 0, fills: [] }
    const orderExecutor = createFakeOrderExecutor(result)
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const productUnlockReader = createFakeProductUnlockReader({
      unlockedKeys: new Set(['asset:acao']),
    })
    const useCase = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)

    const response = await useCase.execute(input)

    expect(response).toEqual(result)
    expect(orderExecutor.calls).toEqual([input])
  })

  it('repassa direto pro OrderExecutor sem checar desbloqueio quando o ativo é sandbox (RF12)', async () => {
    const result = { filled_quantity: 10, remaining_quantity: 0, fills: [] }
    const orderExecutor = createFakeOrderExecutor(result)
    const catalogReader = createFakeCatalogReader({ asset: sandboxAsset })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })
    const useCase = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)

    await useCase.execute({ ...input, asset_id: 'sand-1' })

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
    expect(orderExecutor.calls).toHaveLength(1)
  })

  it('rejeita com ProductLockedError, citando a lição que desbloqueia, quando a chave não está no conjunto do usuário', async () => {
    const orderExecutor = createFakeOrderExecutor({
      filled_quantity: 0,
      remaining_quantity: 0,
      fills: [],
    })
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const productUnlockReader = createFakeProductUnlockReader({
      unlockedKeys: new Set(),
      lessonHint: { code: '2.3', title: 'Nomenclatura de tickers' },
    })
    const useCase = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)

    await expect(useCase.execute(input)).rejects.toThrow(ProductLockedError)
    expect(orderExecutor.calls).toEqual([])
  })

  it('repassa ordem de venda direto pro OrderExecutor mesmo com o ativo travado (vender posição já detida não é comprar)', async () => {
    const result = { filled_quantity: 10, remaining_quantity: 0, fills: [] }
    const orderExecutor = createFakeOrderExecutor(result)
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })
    const useCase = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)

    await useCase.execute({ ...input, side: 'sell' })

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
    expect(orderExecutor.calls).toHaveLength(1)
  })

  it('não checa desbloqueio quando o asset_id é de uma classe fora do escopo deste endpoint (deixa o motor validar a classe)', async () => {
    const orderExecutor = createFakeOrderExecutor({ filled_quantity: 0, remaining_quantity: 0, fills: [] })
    const catalogReader = createFakeCatalogReader({ asset: { ...equityAsset, type: 'cdb' } })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })
    const useCase = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)

    await useCase.execute(input)

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
    expect(orderExecutor.calls).toHaveLength(1)
  })
})
