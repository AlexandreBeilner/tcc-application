import type {
  FixedIncomeExecutor,
  PurchaseFixedIncomeInput,
  PurchaseFixedIncomeResult,
} from '../ports/fixedIncomeExecutor'

export class PurchaseFixedIncomeUseCase {
  constructor(private readonly fixedIncomeExecutor: FixedIncomeExecutor) {}

  execute(input: PurchaseFixedIncomeInput): Promise<PurchaseFixedIncomeResult> {
    return this.fixedIncomeExecutor.purchase(input)
  }
}
