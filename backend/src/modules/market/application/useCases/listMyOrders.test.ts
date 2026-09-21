import { describe, expect, it } from 'vitest'
import { createFakeCatalogReader } from '../../test/fakes/fakeCatalogReader'
import { createFakeOrderExecutor } from '../../test/fakes/fakeOrderExecutor'
import type { AssetDetail } from '../ports/catalogReader'
import { ListMyOrdersUseCase } from './listMyOrders'

const equityAsset: AssetDetail = {
  id: 'asset-1',
  ticker: 'VALR3',
  name: 'Vale ON',
  type: 'acao',
  is_sandbox: false,
}

describe('ListMyOrdersUseCase', () => {
  it('lista as ordens do usuário, enriquecidas com ticker/nome via CatalogReader', async () => {
    const orderExecutor = createFakeOrderExecutor({
      order_id: 'unused',
      filled_quantity: 0,
      remaining_quantity: 0,
      fills: [],
    })
    orderExecutor.listResult = [
      {
        order_id: 'order-1',
        asset_id: 'asset-1',
        side: 'buy',
        type: 'market',
        quantity: 10,
        filled_quantity: 10,
        price: 25,
        status: 'filled',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        order_id: 'order-2',
        asset_id: 'asset-1',
        side: 'sell',
        type: 'limit',
        quantity: 5,
        filled_quantity: 0,
        price: 30,
        status: 'cancelled',
        cancel_reason: 'user_cancelled',
        created_at: '2026-01-02T00:00:00Z',
      },
    ]
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const useCase = new ListMyOrdersUseCase(orderExecutor, catalogReader)

    const result = await useCase.execute({ userId: 'user-1' })

    expect(orderExecutor.listCalls).toEqual(['user-1'])
    // Dedup por asset_id (tarefa O.3): as duas ordens são do mesmo ativo,
    // getAsset só deveria ser chamado uma vez.
    expect(catalogReader.getAssetCalls).toEqual(['asset-1'])
    expect(result).toEqual([
      {
        order_id: 'order-1',
        asset_id: 'asset-1',
        ticker: 'VALR3',
        name: 'Vale ON',
        side: 'buy',
        type: 'market',
        quantity: 10,
        filled_quantity: 10,
        price: 25,
        status: 'filled',
        cancel_reason: undefined,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        order_id: 'order-2',
        asset_id: 'asset-1',
        ticker: 'VALR3',
        name: 'Vale ON',
        side: 'sell',
        type: 'limit',
        quantity: 5,
        filled_quantity: 0,
        price: 30,
        status: 'cancelled',
        cancel_reason: 'user_cancelled',
        created_at: '2026-01-02T00:00:00Z',
      },
    ])
  })

  it('lista vazia quando o usuário não tem nenhuma ordem (sem chamar o catálogo)', async () => {
    const orderExecutor = createFakeOrderExecutor({
      order_id: 'unused',
      filled_quantity: 0,
      remaining_quantity: 0,
      fills: [],
    })
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const useCase = new ListMyOrdersUseCase(orderExecutor, catalogReader)

    const result = await useCase.execute({ userId: 'user-1' })

    expect(result).toEqual([])
    expect(catalogReader.getAssetCalls).toEqual([])
  })
})
