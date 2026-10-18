import { describe, expect, it, vi } from 'vitest'
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
    const result = { order_id: 'order-1', filled_quantity: 10, remaining_quantity: 0, fills: [] }
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
    const result = { order_id: 'order-1', filled_quantity: 10, remaining_quantity: 0, fills: [] }
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
      order_id: 'order-1',
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
    const result = { order_id: 'order-1', filled_quantity: 10, remaining_quantity: 0, fills: [] }
    const orderExecutor = createFakeOrderExecutor(result)
    const catalogReader = createFakeCatalogReader({ asset: equityAsset })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })
    const useCase = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)

    await useCase.execute({ ...input, side: 'sell' })

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
    expect(orderExecutor.calls).toHaveLength(1)
  })

  it('não checa desbloqueio quando o asset_id é de uma classe fora do escopo deste endpoint (deixa o motor validar a classe)', async () => {
    const orderExecutor = createFakeOrderExecutor({
      order_id: 'order-1',
      filled_quantity: 0,
      remaining_quantity: 0,
      fills: [],
    })
    const catalogReader = createFakeCatalogReader({ asset: { ...equityAsset, type: 'cdb' } })
    const productUnlockReader = createFakeProductUnlockReader({ unlockedKeys: new Set() })
    const useCase = new PlaceOrderUseCase(orderExecutor, catalogReader, productUnlockReader)

    await useCase.execute(input)

    expect(productUnlockReader.getUnlockedKeysCalls).toEqual([])
    expect(orderExecutor.calls).toHaveLength(1)
  })

  describe('aviso de operação ao vivo (RT.1.1)', () => {
    const filled = { order_id: 'o-1', filled_quantity: 10, remaining_quantity: 0, fills: [] }
    const resting = { order_id: 'o-2', filled_quantity: 0, remaining_quantity: 10, fills: [] }
    const unlocked = createFakeProductUnlockReader({ unlockedKeys: new Set(['asset:acao']) })

    function build(asset: AssetDetail, result = filled) {
      const calls: Array<[string, string]> = []
      const listener = {
        onLiveTrade: async (userId: string, kind: string) => {
          calls.push([userId, kind])
        },
      }
      const useCase = new PlaceOrderUseCase(
        createFakeOrderExecutor(result),
        createFakeCatalogReader({ asset }),
        unlocked,
        listener,
      )
      return { useCase, calls, listener }
    }

    it('avisa quando a ordem de um ativo ao vivo teve execução', async () => {
      const { useCase, calls } = build(equityAsset)
      await useCase.execute(input)
      expect(calls).toEqual([['user-1', 'order']])
    })

    it('ordem de Sandbox não gera aviso', async () => {
      const { useCase, calls } = build(sandboxAsset)
      await useCase.execute({ ...input, asset_id: 'sand-1' })
      expect(calls).toEqual([])
    })

    it('ordem que só ficou no livro, sem execução, não gera aviso', async () => {
      const { useCase, calls } = build(equityAsset, resting)
      await useCase.execute(input)
      expect(calls).toEqual([])
    })

    it('falha do listener nunca derruba a ordem já executada', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { useCase, listener } = build(equityAsset)
      listener.onLiveTrade = async () => {
        throw new Error('boom')
      }
      await expect(useCase.execute(input)).resolves.toEqual(filled)
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })
  })
})
