import { describe, expect, it } from 'vitest'
import { createFakeOrderExecutor } from '../../test/fakes/fakeOrderExecutor'
import { CancelOrderUseCase } from './cancelOrder'

describe('CancelOrderUseCase', () => {
  it('repassa order_id/user_id direto pro OrderExecutor', async () => {
    const orderExecutor = createFakeOrderExecutor({
      order_id: 'order-1',
      filled_quantity: 0,
      remaining_quantity: 0,
      fills: [],
    })
    const useCase = new CancelOrderUseCase(orderExecutor)

    await useCase.execute({ order_id: 'order-1', user_id: 'user-1' })

    expect(orderExecutor.cancelCalls).toEqual([{ orderId: 'order-1', userId: 'user-1' }])
  })

  it('propaga o erro do OrderExecutor (ex: EngineRequestError 404/409 traduzido pelo motor)', async () => {
    const orderExecutor = createFakeOrderExecutor({
      order_id: 'order-1',
      filled_quantity: 0,
      remaining_quantity: 0,
      fills: [],
    })
    orderExecutor.errorToThrow = new Error('ordem não encontrada')
    const useCase = new CancelOrderUseCase(orderExecutor)

    await expect(useCase.execute({ order_id: 'order-1', user_id: 'user-1' })).rejects.toThrow(
      'ordem não encontrada',
    )
  })
})
