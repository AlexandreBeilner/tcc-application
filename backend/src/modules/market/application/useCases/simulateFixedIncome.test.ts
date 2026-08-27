import { describe, expect, it } from 'vitest'
import { createFakeFixedIncomeExecutor } from '../../test/fakes/fakeFixedIncomeExecutor'
import { SimulateFixedIncomeUseCase } from './simulateFixedIncome'

describe('SimulateFixedIncomeUseCase', () => {
  it('repassa a simulação (sem user_id, sem conta envolvida) pro FixedIncomeExecutor', async () => {
    const result = {
      unit_price: 798.27,
      quantity_purchased: 2.5,
      gross_projected_value: 2100,
      tax_rate: 0.2,
      net_projected_value: 2080,
    }
    const fixedIncomeExecutor = createFakeFixedIncomeExecutor({ simulate: result })
    const useCase = new SimulateFixedIncomeUseCase(fixedIncomeExecutor)

    const input = { asset_id: 'asset-1', amount: 2000, days_held: 200 }
    const response = await useCase.execute(input)

    expect(response).toEqual(result)
    expect(fixedIncomeExecutor.simulateCalls).toEqual([input])
  })
})
