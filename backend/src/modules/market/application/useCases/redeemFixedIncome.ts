import type {
  FixedIncomeExecutor,
  RedeemFixedIncomeInput,
  RedeemFixedIncomeResult,
} from '../ports/fixedIncomeExecutor'

export class RedeemFixedIncomeUseCase {
  constructor(private readonly fixedIncomeExecutor: FixedIncomeExecutor) {}

  execute(input: RedeemFixedIncomeInput): Promise<RedeemFixedIncomeResult> {
    return this.fixedIncomeExecutor.redeem(input)
  }
}
