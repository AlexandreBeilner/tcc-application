import type {
  FixedIncomeExecutor,
  FixedIncomeTaxRateInput,
  FixedIncomeTaxRateResult,
} from '../ports/fixedIncomeExecutor'

export class GetFixedIncomeTaxRateUseCase {
  constructor(private readonly fixedIncomeExecutor: FixedIncomeExecutor) {}

  execute(input: FixedIncomeTaxRateInput): Promise<FixedIncomeTaxRateResult> {
    return this.fixedIncomeExecutor.getTaxRate(input)
  }
}
