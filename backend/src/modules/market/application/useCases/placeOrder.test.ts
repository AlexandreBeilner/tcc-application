import { describe, expect, it } from 'vitest'
import { createFakeOrderExecutor } from '../../test/fakes/fakeOrderExecutor'
import { PlaceOrderUseCase } from './placeOrder'

describe('PlaceOrderUseCase', () => {
  it('repassa a ordem (já com user_id injetado pelo router) pro OrderExecutor', async () => {
    const result = { filled_quantity: 10, remaining_quantity: 0, fills: [] }
    const orderExecutor = createFakeOrderExecutor(result)
    const useCase = new PlaceOrderUseCase(orderExecutor)

    const input = {
      user_id: 'user-1',
      asset_id: 'asset-1',
      side: 'buy' as const,
      type: 'market' as const,
      quantity: 10,
    }
    const response = await useCase.execute(input)

    expect(response).toEqual(result)
    expect(orderExecutor.calls).toEqual([input])
  })
})
