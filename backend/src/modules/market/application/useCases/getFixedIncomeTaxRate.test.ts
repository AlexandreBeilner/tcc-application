import { describe, expect, it } from 'vitest'
import { createFakeFixedIncomeExecutor } from '../../test/fakes/fakeFixedIncomeExecutor'
import { GetFixedIncomeTaxRateUseCase } from './getFixedIncomeTaxRate'

describe('GetFixedIncomeTaxRateUseCase', () => {
  it('repassa a alíquota (sem user_id, sem asset_id) pro FixedIncomeExecutor', async () => {
    const result = { tax_rate: 0.175 }
    const fixedIncomeExecutor = createFakeFixedIncomeExecutor({ getTaxRate: result })
    const useCase = new GetFixedIncomeTaxRateUseCase(fixedIncomeExecutor)

    const input = { days_held: 400 }
    const response = await useCase.execute(input)

    expect(response).toEqual(result)
    expect(fixedIncomeExecutor.getTaxRateCalls).toEqual([input])
  })
})
