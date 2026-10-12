import { investmentReturnPct, toRiskCapitalSnapshot } from '../../domain/profitability'
import type { Snapshot } from '../../domain/networth'
import type { SandboxAssetReader } from '../ports/sandboxAssetReader'
import type { NetWorthReader } from './getNetWorth'

export interface PeriodReturn {
  // Rentabilidade percentual do período (mesma fórmula do ranking: sobre capital de risco,
  // nunca sobre caixa parado). Nunca patrimônio absoluto (RNF09).
  returnPct: number
  // A pessoa fez alguma operação de renda variável ou de renda fixa dentro do período.
  operated: boolean
}

function hasTraded(start: Snapshot, end: Snapshot): boolean {
  const fixedStart = start.byClass?.fixedIncome
  const fixedEnd = end.byClass?.fixedIncome
  const fixedMoved =
    fixedStart !== undefined &&
    fixedEnd !== undefined &&
    (fixedEnd.investedCost !== fixedStart.investedCost ||
      fixedEnd.disinvestedProceeds !== fixedStart.disinvestedProceeds)
  return end.tradesExecuted > start.tradesExecuted || fixedMoved
}

// Rentabilidade de uma pessoa entre dois instantes quaisquer (duelos, MO.5.3), reconstruída pelo
// replay do log de eventos nas duas pontas, com a renda fixa a custo dos dois lados (mesma
// metodologia, então comparável). Determinística: o mesmo par de instantes dá o mesmo resultado
// em qualquer momento depois de `to`.
export class MeasurePeriodReturnUseCase {
  constructor(
    private readonly getNetWorth: NetWorthReader,
    private readonly sandboxAssetReader: SandboxAssetReader,
  ) {}

  async execute(input: { userId: string; from: Date; to: Date }): Promise<PeriodReturn> {
    const sandboxAssetIds = await this.sandboxAssetReader.listSandboxAssetIds()
    const [start, end] = await Promise.all([
      this.getNetWorth.execute({ userId: input.userId, asOf: input.from, sandboxAssetIds }),
      this.getNetWorth.execute({ userId: input.userId, asOf: input.to, sandboxAssetIds }),
    ])
    return {
      returnPct: investmentReturnPct(toRiskCapitalSnapshot(end), toRiskCapitalSnapshot(start)),
      operated: hasTraded(start, end),
    }
  }
}
