import {
  extractWindowFlows,
  investmentDietzReturnPct,
  investmentReturnPct,
  toRiskCapitalSnapshot,
} from '../../domain/profitability'
import type { Snapshot } from '../../domain/networth'
import type { AccountEventsReader } from '../ports/accountEventsReader'
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
//
// Com `accountEventsReader` (duelos), o denominador é o do Dietz modificado
// (`investmentDietzReturnPct`, o mesmo do ranking): aportar perto do fim do período não dilui o
// retorno, então o vencedor é quem rendeu mais, não quem aportou menos. Sem ele (retrospectiva
// mensal), mantém a fórmula sobre o custo investido.
export class MeasurePeriodReturnUseCase {
  constructor(
    private readonly getNetWorth: NetWorthReader,
    private readonly sandboxAssetReader: SandboxAssetReader,
    private readonly accountEventsReader?: AccountEventsReader,
  ) {}

  async execute(input: { userId: string; from: Date; to: Date }): Promise<PeriodReturn> {
    const sandboxAssetIds = await this.sandboxAssetReader.listSandboxAssetIds()
    const [start, end] = await Promise.all([
      this.getNetWorth.execute({ userId: input.userId, asOf: input.from, sandboxAssetIds }),
      this.getNetWorth.execute({ userId: input.userId, asOf: input.to, sandboxAssetIds }),
    ])
    const returnPct = this.accountEventsReader
      ? investmentDietzReturnPct(
          toRiskCapitalSnapshot(end),
          toRiskCapitalSnapshot(start),
          extractWindowFlows(
            await this.accountEventsReader.listAllEvents(input.userId),
            sandboxAssetIds,
            input.from,
            input.to,
          ).overall,
          input.from,
          input.to,
        )
      : investmentReturnPct(toRiskCapitalSnapshot(end), toRiskCapitalSnapshot(start))
    return { returnPct, operated: hasTraded(start, end) }
  }
}
