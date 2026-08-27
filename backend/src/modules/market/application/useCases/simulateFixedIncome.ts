import type {
  FixedIncomeExecutor,
  SimulateFixedIncomeInput,
  SimulateFixedIncomeResult,
} from '../ports/fixedIncomeExecutor'

export class SimulateFixedIncomeUseCase {
  constructor(private readonly fixedIncomeExecutor: FixedIncomeExecutor) {}

  execute(input: SimulateFixedIncomeInput): Promise<SimulateFixedIncomeResult> {
    return this.fixedIncomeExecutor.simulate(input)
  }
}
