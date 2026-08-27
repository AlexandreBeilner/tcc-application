import { describe, expect, it } from 'vitest'
import { createFakeFixedIncomeExecutor } from '../../test/fakes/fakeFixedIncomeExecutor'
import { RedeemFixedIncomeUseCase } from './redeemFixedIncome'

describe('RedeemFixedIncomeUseCase', () => {
  it('repassa o resgate (já com user_id injetado pelo router) pro FixedIncomeExecutor', async () => {
    const result = {
      total_value: 1080,
      net_value: 1060,
      tax_rate: 0.175,
      mark_to_market: {
        mark_to_market_price: 1080,
        realized_return_pct: 0.08,
        vs_contracted_rate: -0.02,
      },
    }
    const fixedIncomeExecutor = createFakeFixedIncomeExecutor({ redeem: result })
    const useCase = new RedeemFixedIncomeUseCase(fixedIncomeExecutor)

    const input = { user_id: 'user-1', asset_id: 'asset-1' }
    const response = await useCase.execute(input)

    expect(response).toEqual(result)
    expect(fixedIncomeExecutor.redeemCalls).toEqual([input])
  })
})
