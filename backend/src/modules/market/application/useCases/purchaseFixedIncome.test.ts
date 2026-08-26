import { describe, expect, it } from 'vitest'
import { createFakeFixedIncomeExecutor } from '../../test/fakes/fakeFixedIncomeExecutor'
import { PurchaseFixedIncomeUseCase } from './purchaseFixedIncome'

describe('PurchaseFixedIncomeUseCase', () => {
  it('repassa o aporte (já com user_id injetado pelo router) pro FixedIncomeExecutor', async () => {
    const result = {
      unit_price: 950.2,
      quantity_purchased: 1.052,
      position: { quantity: 1.052, average_price: 950.2, average_rate: 0.11 },
    }
    const fixedIncomeExecutor = createFakeFixedIncomeExecutor({ purchase: result })
    const useCase = new PurchaseFixedIncomeUseCase(fixedIncomeExecutor)

    const input = { user_id: 'user-1', asset_id: 'asset-1', amount: 1000 }
    const response = await useCase.execute(input)

    expect(response).toEqual(result)
    expect(fixedIncomeExecutor.purchaseCalls).toEqual([input])
  })
})
